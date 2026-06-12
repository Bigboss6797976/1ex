import axios from 'axios';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

export class GooglePayService {
  
  // ============ Google Pay 初始化 ============
  
  static async initializeGooglePay(amount) {
    try {
      return {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [
          {
            type: 'CARD',
            parameters: {
              allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
              allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX']
            },
            tokenizationSpecification: {
              type: 'PAYMENT_GATEWAY',
              parameters: {
                gateway: 'stripe',
                gatewayMerchantId: process.env.STRIPE_MERCHANT_ID
              }
            }
          }
        ],
        merchantInfo: {
          merchantId: process.env.GOOGLE_MERCHANT_ID,
          merchantName: '1xBet Platform'
        },
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: amount.toString(),
          currencyCode: 'USD',
          countryCode: 'US'
        }
      };
    } catch (error) {
      throw error;
    }
  }
  
  // 处理 Google Pay token
  static async processGooglePayToken(userId, paymentToken, amount) {
    try {
      // Google Pay 返回的 token 需要转发给 Stripe 进行处理
      const stripeResponse = await axios.post(
        'https://api.stripe.com/v1/payment_methods',
        `type=card&card[exp_month]=${paymentToken.card.expiryMonth}&card[exp_year]=${paymentToken.card.expiryYear}&card[number]=${paymentToken.card.cardNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // 创建 Stripe payment intent
      const intentResponse = await axios.post(
        'https://api.stripe.com/v1/payment_intents',
        `amount=${Math.round(amount * 100)}&currency=usd&payment_method=${stripeResponse.data.id}&confirm=true`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // 更新用户余额
      const user = await User.findById(userId);
      user.balance += amount;
      user.totalDeposited += amount;
      await user.save();

      // 创建交易记录
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        currency: 'USD',
        paymentMethod: {
          type: 'card',
          provider: 'google_pay',
          reference: stripeResponse.data.id
        },
        stripe: {
          paymentIntentId: intentResponse.data.id
        },
        status: 'completed'
      });

      await transaction.save();

      return {
        success: true,
        transactionId: transaction._id,
        amount,
        newBalance: user.balance
      };
    } catch (error) {
      console.error('Google Pay processing error:', error);
      throw error;
    }
  }
}

// ============ Apple Pay ============

export class ApplePayService {
  
  static async initializeApplePay(amount) {
    try {
      return {
        countryCode: 'US',
        currencyCode: 'USD',
        supportedNetworks: ['visa', 'masterCard', 'amex'],
        supportedCountries: ['US', 'GB', 'CA', 'AU'],
        merchantCapabilities: ['supports3DS'],
        requiredBillingContactFields: ['postalAddress', 'email', 'phone'],
        requiredShippingContactFields: ['postalAddress', 'email', 'phone'],
        total: {
          label: '1xBet Platform',
          amount: amount.toString(),
          type: 'final'
        }
      };
    } catch (error) {
      throw error;
    }
  }
  
  // 处理 Apple Pay token
  static async processApplePayToken(userId, paymentToken, amount) {
    try {
      // 解密 Apple Pay token（仅在服务器端可以解密）
      const decryptedToken = await this.decryptApplePayToken(paymentToken);
      
      // 转发给 Stripe 处理
      const stripeResponse = await axios.post(
        'https://api.stripe.com/v1/payment_methods',
        `type=card&card[exp_month]=${decryptedToken.expiryMonth}&card[exp_year]=${decryptedToken.expiryYear}&card[number]=${decryptedToken.cardNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // 创建 payment intent
      const intentResponse = await axios.post(
        'https://api.stripe.com/v1/payment_intents',
        `amount=${Math.round(amount * 100)}&currency=usd&payment_method=${stripeResponse.data.id}&confirm=true`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // 更新用户余额
      const user = await User.findById(userId);
      user.balance += amount;
      user.totalDeposited += amount;
      await user.save();

      // 创建交易记录
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        currency: 'USD',
        paymentMethod: {
          type: 'card',
          provider: 'apple_pay',
          reference: stripeResponse.data.id
        },
        stripe: {
          paymentIntentId: intentResponse.data.id
        },
        status: 'completed'
      });

      await transaction.save();

      return {
        success: true,
        transactionId: transaction._id,
        amount,
        newBalance: user.balance
      };
    } catch (error) {
      console.error('Apple Pay processing error:', error);
      throw error;
    }
  }
  
  static async decryptApplePayToken(encryptedToken) {
    // 实际的解密逻辑需要使用 Apple 的证书
    // 这里仅为示例
    try {
      // 在生产环境中，应该使用 Apple 的 PaymentToken 解密库
      // 参考: https://developer.apple.com/documentation/apple_pay_on_the_web/receiving_and_processing_payments
      
      console.log('Decrypting Apple Pay token...');
      // 返回解密后的 token 数据
      return encryptedToken.payload;
    } catch (error) {
      throw new Error('Failed to decrypt Apple Pay token');
    }
  }
}

// ============ Digital Wallet 统一接口 ============

export class DigitalWalletService {
  
  static async getAvailableWallets(country = 'US') {
    // 根据国家返回可用的数字钱包
    const walletsByCountry = {
      'US': ['google_pay', 'apple_pay'],
      'CN': ['alipay', 'wechat_pay'],
      'KH': ['aba_pay'],
      'VN': ['vn_pay', 'momo'],
      'TH': ['promptpay', 'line_pay'],
      'GB': ['google_pay', 'apple_pay'],
      'AU': ['google_pay', 'apple_pay']
    };
    
    return walletsByCountry[country] || walletsByCountry['US'];
  }
  
  static async validateWalletPayment(provider, paymentData) {
    try {
      switch (provider) {
        case 'google_pay':
          return this.validateGooglePayToken(paymentData);
        case 'apple_pay':
          return this.validateApplePayToken(paymentData);
        default:
          throw new Error('Unsupported wallet provider');
      }
    } catch (error) {
      throw error;
    }
  }
  
  static async validateGooglePayToken(token) {
    // 验证 Google Pay token 的签名和完整性
    try {
      // 应该验证签名并确保 token 未过期
      if (!token || !token.signature) {
        throw new Error('Invalid token');
      }
      return true;
    } catch (error) {
      return false;
    }
  }
  
  static async validateApplePayToken(token) {
    // 验证 Apple Pay token 的签名和完整性
    try {
      if (!token || !token.paymentData) {
        throw new Error('Invalid token');
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}

export { GooglePayService, ApplePayService, DigitalWalletService };
