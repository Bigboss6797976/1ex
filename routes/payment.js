import express from 'express';
import PaymentService from '../services/PaymentService.js';
import Stripe from 'stripe';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ============ STRIPE 支付 ============

// 创建支付意图（Stripe）
router.post('/stripe/create-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;
    const userId = req.user._id;
    
    // 验证金额
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const result = await PaymentService.createStripePaymentIntent(userId, amount, currency);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    // 处理事件
    await PaymentService.handleStripeWebhook(event);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ USDT TRC20 支付 ============

// 生成 USDT 充值地址
router.post('/usdt/generate-address', async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await PaymentService.generateUSDTDepositAddress(userId);
    
    res.json({
      success: true,
      address: result.address,
      network: result.network,
      memo: result.memo,
      qrCode: `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(result.address)}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 验证 USDT 交易（由监听服务调用）
router.post('/usdt/verify-transaction', async (req, res) => {
  try {
    const { txHash, userId, amount } = req.body;
    
    const user = await User.findById(userId);
    const expectedAddress = user.cryptoWallet?.address;
    
    if (!expectedAddress) {
      return res.status(400).json({ error: 'No crypto wallet configured' });
    }
    
    const verification = await PaymentService.verifyUSDTTransaction(
      txHash,
      amount,
      expectedAddress
    );
    
    if (verification.valid) {
      // 更新用户余额
      user.balance += amount;
      user.totalDeposited += amount;
      await user.save();
      
      // 创建交易记录
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        currency: 'USDT',
        paymentMethod: {
          type: 'crypto',
          provider: 'usdt',
          reference: txHash
        },
        crypto: {
          txHash,
          toAddress: expectedAddress,
          confirmations: verification.confirmations,
          network: 'TRC20'
        },
        status: 'completed'
      });
      
      await transaction.save();
      
      res.json({
        success: true,
        message: 'USDT deposit confirmed',
        newBalance: user.balance
      });
    } else {
      res.status(400).json({ error: 'Transaction verification failed' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 银行转账 ============

// 发起电汇（SWIFT/SEPA）
router.post('/bank/wire-transfer', async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    const userId = req.user._id;
    
    // 验证 KYC
    const user = await User.findById(userId);
    if (user.kyc.status !== 'verified') {
      return res.status(403).json({ error: 'KYC verification required' });
    }
    
    const result = await PaymentService.initiateWireTransfer(userId, amount, bankDetails);
    
    res.json({
      success: true,
      transactionId: result.transactionId,
      status: result.status,
      estimatedTime: result.estimatedTime,
      fee: amount * 0.01 // 1% 手续费示例
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 电子钱包支付 ============

// 创建电钱包支付
router.post('/ewallet/:provider', async (req, res) => {
  try {
    const { amount } = req.body;
    const { provider } = req.params;
    const userId = req.user._id;
    
    const result = await PaymentService.createEWalletPayment(userId, amount, provider);
    
    res.json({
      success: true,
      transactionId: result.transactionId,
      paymentUrl: result.paymentUrl,
      provider: result.provider,
      amount: result.amount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 支付宝回调
router.post('/alipay/callback', async (req, res) => {
  try {
    const { out_trade_no, trade_no, trade_status, total_amount } = req.query;
    
    if (trade_status === 'TRADE_SUCCESS') {
      // 更新交易
      const [prefix, userId] = out_trade_no.split('-');
      const user = await User.findById(userId);
      
      user.balance += parseFloat(total_amount);
      user.totalDeposited += parseFloat(total_amount);
      await user.save();
      
      // 创建交易记录
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount: parseFloat(total_amount),
        currency: 'USD',
        paymentMethod: {
          type: 'ewallet',
          provider: 'alipay',
          reference: trade_no
        },
        status: 'completed'
      });
      
      await transaction.save();
    }
    
    res.send('success');
  } catch (error) {
    console.error('Alipay callback error:', error);
    res.status(400).send('failure');
  }
});

// 微信支付回调
router.post('/wechat/callback', async (req, res) => {
  try {
    const { resource } = req.body;
    
    if (resource.result_code === 'SUCCESS') {
      const [prefix, userId] = resource.out_trade_no.split('-');
      const amount = resource.amount.total / 100;
      
      const user = await User.findById(userId);
      user.balance += amount;
      user.totalDeposited += amount;
      await user.save();
      
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        currency: 'USD',
        paymentMethod: {
          type: 'ewallet',
          provider: 'wechat',
          reference: resource.transaction_id
        },
        status: 'completed'
      });
      
      await transaction.save();
    }
    
    res.json({ code: 'SUCCESS' });
  } catch (error) {
    console.error('WeChat callback error:', error);
    res.status(400).json({ code: 'FAIL' });
  }
});

// ============ 提现 ============

// 请求提现
router.post('/withdrawal/request', async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;
    
    const result = await PaymentService.requestWithdrawal(userId, amount);
    
    res.json({
      success: true,
      transactionId: result.transactionId,
      amount: result.amount,
      status: result.status,
      estimatedTime: result.estimatedTime
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ 交易历史 ============

// 获取交易历史
router.get('/transactions', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const userId = req.user._id;
    const skip = (page - 1) * limit;
    
    const result = await PaymentService.getTransactionHistory(userId, parseInt(limit), skip);
    
    res.json({
      success: true,
      transactions: result.transactions,
      total: result.total,
      pages: result.pages,
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个交易详情
router.get('/transaction/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction || transaction.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取账户余额
router.get('/balance', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      balance: user.balance,
      currency: user.preferences.currency,
      totalDeposited: user.totalDeposited,
      totalWithdrawn: user.totalWithdrawn
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 现金充值 ============

router.post('/cash/deposit', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;
    
    if (!amount || amount < 50) {
      return res.status(400).json({ error: 'Minimum cash deposit: $50' });
    }
    
    const result = await PaymentService.createCashDeposit(userId, amount);
    
    res.json({
      success: true,
      transactionId: result.transactionId,
      status: result.status,
      message: result.message,
      bankDetails: result.bankDetails
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 电子钱包支付 - Alipay、WeChat、ABA Pay ============

router.post('/ewallet/:provider', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const { provider } = req.params;
    const userId = req.user._id;
    
    if (!['alipay', 'wechat', 'aba_pay'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    if (!amount || amount < 10) {
      return res.status(400).json({ error: 'Minimum deposit: $10' });
    }
    
    const result = await PaymentService.createEWalletPayment(userId, amount, provider);
    
    res.json({
      success: true,
      transactionId: result.transactionId,
      paymentUrl: result.paymentUrl,
      provider: result.provider,
      amount: result.amount,
      reference: result.reference
    });
  } catch (error) {
    console.error(`${provider} payment error:`, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
