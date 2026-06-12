import Stripe from 'stripe';
import { ethers } from 'ethers';
import axios from 'axios';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export class PaymentService {
  
  // ============ STRIPE 支付 ============
  
  static async createStripePaymentIntent(userId, amount, currency = 'usd') {
    try {
      const user = await User.findById(userId);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // 转换为分
        currency: currency.toLowerCase(),
        customer: user.stripe?.customerId,
        metadata: {
          userId: userId.toString(),
          purpose: 'deposit'
        }
      });
      
      // 记录交易（待处理）
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        currency: currency.toUpperCase(),
        paymentMethod: {
          type: 'card',
          provider: 'stripe',
          reference: paymentIntent.id
        },
        stripe: {
          paymentIntentId: paymentIntent.id
        },
        status: 'processing'
      });
      
      await transaction.save();
      
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        currency
      };
    } catch (error) {
      console.error('Stripe payment intent error:', error);
      throw error;
    }
  }
  
  // 处理 Stripe webhook
  static async handleStripeWebhook(event) {
    try {
      const { type, data } = event;
      
      switch (type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = data.object;
          const userId = paymentIntent.metadata.userId;
          const amount = paymentIntent.amount / 100;
          
          // 更新用户余额
          const user = await User.findById(userId);
          user.balance += amount;
          user.totalDeposited += amount;
          await user.save();
          
          // 更新交易状态
          const transaction = await Transaction.findOne({
            'stripe.paymentIntentId': paymentIntent.id
          });
          if (transaction) {
            transaction.status = 'completed';
            transaction.completedAt = new Date();
            await transaction.save();
          }
          
          console.log(`✅ Deposit confirmed: ${userId} +${amount}`);
          break;
        }
        
        case 'payment_intent.payment_failed': {
          const paymentIntent = data.object;
          const transaction = await Transaction.findOne({
            'stripe.paymentIntentId': paymentIntent.id
          });
          if (transaction) {
            transaction.status = 'failed';
            transaction.failureReason = paymentIntent.last_payment_error?.message;
            await transaction.save();
          }
          console.log(`❌ Payment failed: ${paymentIntent.id}`);
          break;
        }
        
        case 'charge.refunded': {
          const charge = data.object;
          const transaction = await Transaction.findOne({
            'stripe.paymentIntentId': charge.payment_intent
          });
          if (transaction) {
            transaction.status = 'failed';
            transaction.stripe.refundId = charge.refunds.data[0].id;
            await transaction.save();
          }
          break;
        }
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }
  
  // ============ USDT TRC20 支付 ============
  
  static async generateUSDTDepositAddress(userId) {
    try {
      const user = await User.findById(userId);
      
      // 如果用户已有钱包地址，直接返回
      if (user.cryptoWallet?.address) {
        return {
          address: user.cryptoWallet.address,
          network: 'TRC20',
          amount: user.balance
        };
      }
      
      // 生成新的 TRC20 地址（实现简化，实际应使用 Web3 库）
      const newAddress = '0x' + require('crypto').randomBytes(20).toString('hex');
      
      user.cryptoWallet = {
        address: newAddress,
        network: 'TRC20',
        verified: false
      };
      
      await user.save();
      
      return {
        address: newAddress,
        network: 'TRC20',
        memo: `Deposit to ${userId}`
      };
    } catch (error) {
      console.error('USDT address generation error:', error);
      throw error;
    }
  }
  
  // 验证 USDT TRC20 交易（webhook 从区块链监听）
  static async verifyUSDTTransaction(txHash, expectedAmount, expectedAddress) {
    try {
      // 调用 TronGrid API 验证交易
      const response = await axios.get(
        `https://api.trongrid.io/v1/transaction/${txHash}`,
        { headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY } }
      );
      
      const txData = response.data;
      
      if (txData.ret[0].contractRet !== 'Success') {
        throw new Error('Transaction failed on blockchain');
      }
      
      // 验证金额和地址
      const transfer = txData.raw_data.contract[0].parameter.value;
      const amount = transfer.amount / 1e6; // USDT 是 6 位小数
      const toAddress = transfer.to_address;
      
      if (amount !== expectedAmount || toAddress !== expectedAddress) {
        throw new Error('Transaction amount or address mismatch');
      }
      
      return {
        valid: true,
        amount,
        confirmations: txData.confirmations || 0,
        timestamp: txData.raw_data.timestamp
      };
    } catch (error) {
      console.error('USDT verification error:', error);
      throw error;
    }
  }
  
  // ============ 银行转账（国际电汇 SWIFT/SEPA）============
  
  static async initiateWireTransfer(userId, amount, bankDetails) {
    try {
      const user = await User.findById(userId);
      
      // 创建提现请求
      const transaction = new Transaction({
        userId,
        type: 'withdrawal',
        amount,
        currency: 'USD',
        paymentMethod: {
          type: 'bank',
          provider: 'swift'
        },
        bank: {
          bankName: bankDetails.bankName,
          accountHolder: bankDetails.accountHolder,
          routingNumber: bankDetails.routingNumber,
          swiftCode: bankDetails.swiftCode,
          accountNumber: bankDetails.accountNumber
        },
        status: 'pending'
      });
      
      await transaction.save();
      
      // 发送给财务部门处理（实际实现中应集成 Wise API 或银行 API）
      console.log(`Wire transfer request created: ${transaction._id}`);
      
      return {
        transactionId: transaction._id,
        status: 'pending',
        estimatedTime: '2-5 business days'
      };
    } catch (error) {
      console.error('Wire transfer error:', error);
      throw error;
    }
  }
  
  // ============ 电子钱包支付（Alipay、WeChat Pay、ABA Pay）============
  
  static async createEWalletPayment(userId, amount, provider) {
    try {
      let paymentUrl;
      let reference;
      
      switch (provider) {
        case 'alipay':
          const aliResult = await this.createAlipayPayment(amount, userId);
          paymentUrl = aliResult.url;
          reference = aliResult.tradeNo;
          break;
        case 'wechat':
          const wxResult = await this.createWechatPayment(amount, userId);
          paymentUrl = wxResult.url;
          reference = wxResult.tradeNo;
          break;
        case 'aba_pay':
          const abaResult = await this.createABAPayment(amount, userId);
          paymentUrl = abaResult.url;
          reference = abaResult.tradeNo;
          break;
        default:
          throw new Error('Unsupported provider');
      }
      
      // 创建待处理交易
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        currency: 'USD',
        paymentMethod: {
          type: 'ewallet',
          provider,
          reference
        },
        status: 'pending'
      });
      
      await transaction.save();
      
      return {
        transactionId: transaction._id,
        paymentUrl,
        provider,
        amount,
        reference
      };
    } catch (error) {
      console.error('E-wallet payment error:', error);
      throw error;
    }
  }
  
  static async createAlipayPayment(amount, userId) {
    // 集成支付宝国际版 API
    try {
      const tradeNo = `ALI-${userId}-${Date.now()}`;
      
      const response = await axios.post(
        'https://openapi.alipay.com/gateway.do',
        {
          app_id: process.env.ALIPAY_APP_ID,
          method: 'alipay.trade.page.pay',
          charset: 'utf-8',
          sign_type: 'RSA2',
          timestamp: new Date().toISOString(),
          version: '1.0',
          out_trade_no: tradeNo,
          total_amount: amount.toString(),
          subject: 'Platform Deposit',
          return_url: `${process.env.BACKEND_URL}/api/payment/alipay/callback`
        }
      );
      
      return {
        url: response.data,
        tradeNo
      };
    } catch (error) {
      throw error;
    }
  }
  
  static async createWechatPayment(amount, userId) {
    // 集成微信支付 API（国际版或国内版）
    try {
      const tradeNo = `WX-${userId}-${Date.now()}`;
      
      const response = await axios.post(
        'https://api.mch.weixin.qq.com/v3/pay/transactions/native',
        {
          mchid: process.env.WECHAT_MCH_ID,
          out_trade_no: tradeNo,
          amount: { total: Math.round(amount * 100) },
          description: 'Platform Deposit',
          notify_url: `${process.env.BACKEND_URL}/api/payment/wechat/callback`
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.WECHAT_API_TOKEN}`
          }
        }
      );
      
      return {
        url: response.data.code_url,
        tradeNo
      };
    } catch (error) {
      throw error;
    }
  }
  
  static async createABAPayment(amount, userId) {
    // 集成 ABA Bank 支付（柬埔寨）
    try {
      const tradeNo = `ABA-${userId}-${Date.now()}`;
      
      const response = await axios.post(
        'https://api.ababank.com/api/payment/request',
        {
          merchant_id: process.env.ABA_MERCHANT_ID,
          api_key: process.env.ABA_API_KEY,
          transaction_id: tradeNo,
          amount: amount.toString(),
          currency: 'USD',
          payment_description: 'Platform Deposit',
          success_redirect_url: `${process.env.FRONTEND_URL}/deposit/success?tid=${tradeNo}`,
          fail_redirect_url: `${process.env.FRONTEND_URL}/deposit/failed?tid=${tradeNo}`,
          return_params: {
            userId: userId.toString()
          }
        }
      );
      
      return {
        url: response.data.payment_url,
        tradeNo
      };
    } catch (error) {
      console.error('ABA Pay error:', error);
      throw error;
    }
  }
  
  static async createCashDeposit(userId, amount) {
    // 现金充值（线下处理）
    try {
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        currency: 'USD',
        paymentMethod: {
          type: 'cash',
          provider: 'manual',
          reference: `CASH-${userId}-${Date.now()}`
        },
        status: 'pending',
        description: 'Cash deposit - requires verification'
      });
      
      await transaction.save();
      
      return {
        transactionId: transaction._id,
        status: 'pending',
        message: 'Cash deposit request submitted. Please contact support for instructions.',
        bankDetails: {
          // 提供银行账户信息供用户转账
          bankName: process.env.BANK_NAME || 'ABC Bank',
          accountName: process.env.BANK_ACCOUNT_NAME || 'Platform Account',
          accountNumber: process.env.BANK_ACCOUNT_NUMBER || '123456789',
          routingNumber: process.env.BANK_ROUTING_NUMBER || '000000000'
        }
      };
    } catch (error) {
      throw error;
    }
  }
  
  // ============ 提现 ============
  
  static async requestWithdrawal(userId, amount) {
    try {
      const user = await User.findById(userId);
      
      // 检查余额
      if (user.balance < amount) {
        throw new Error('Insufficient balance');
      }
      
      // 检查 KYC
      if (user.kyc.status !== 'verified') {
        throw new Error('KYC verification required for withdrawal');
      }
      
      // 扣除余额（待处理）
      user.balance -= amount;
      await user.save();
      
      // 创建提现交易
      const transaction = new Transaction({
        userId,
        type: 'withdrawal',
        amount,
        currency: 'USD',
        status: 'pending'
      });
      
      await transaction.save();
      
      return {
        transactionId: transaction._id,
        amount,
        status: 'pending',
        estimatedTime: '24-48 hours'
      };
    } catch (error) {
      console.error('Withdrawal error:', error);
      throw error;
    }
  }
  
  // ============ 获取交易历史 ============
  
  static async getTransactionHistory(userId, limit = 50, skip = 0) {
    try {
      const transactions = await Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
      
      const total = await Transaction.countDocuments({ userId });
      
      return {
        transactions,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get transactions error:', error);
      throw error;
    }
  }
}

export default PaymentService;
