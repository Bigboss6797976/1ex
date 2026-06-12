import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // 交易类型
  type: { 
    type: String, 
    enum: [
      'deposit', // 充值
      'withdrawal', // 提现
      'bet_placed', // 下注
      'bet_won', // 赢注
      'bet_lost', // 输注
      'bonus_received', // 领取奖金
      'commission', // 推荐佣金
      'refund', // 退款
      'adjustment', // 管理员调整
      'vip_reward' // VIP奖励
    ], 
    required: true 
  },
  
  // 金额（单位：USD 或 USDT）
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD', enum: ['USD', 'USDT', 'EUR', 'CNY'] },
  
  // 手续费
  fee: { type: Number, default: 0 },
  feeType: { type: String, enum: ['deposit', 'withdrawal', 'platform'], default: 'platform' },
  
  // 状态
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'disputed'],
    default: 'pending'
  },
  
  // 支付详情
  paymentMethod: {
    type: { type: String, enum: ['card', 'bank', 'crypto', 'ewallet'] },
    provider: String, // stripe, wise, usdt, alipay, wechat
    reference: String, // 支付网关的交易 ID
    cardLast4: String,
    bankName: String
  },
  
  // Stripe 集成
  stripe: {
    paymentIntentId: String,
    customerId: String,
    invoiceId: String,
    refundId: String
  },
  
  // 加密货币交易
  crypto: {
    txHash: String, // 交易哈希
    fromAddress: String,
    toAddress: String,
    confirmations: { type: Number, default: 0 },
    gasUsed: String,
    network: { type: String, enum: ['TRC20', 'ERC20', 'BEP20'] }
  },
  
  // 银行转账（SWIFT/SEPA）
  bank: {
    referenceNumber: String,
    bankName: String,
    accountHolder: String,
    routingNumber: String,
    accountNumber: String,
    swiftCode: String,
    description: String
  },
  
  // 关联订单（如果是游戏/投注相关）
  relatedBetId: mongoose.Schema.Types.ObjectId,
  relatedGameId: mongoose.Schema.Types.ObjectId,
  
  // 描述
  description: String,
  memo: String,
  
  // 失败原因
  failureReason: String,
  errorCode: String,
  
  // IP 和设备信息（安全审计）
  ipAddress: String,
  userAgent: String,
  country: String,
  
  // 管理备注
  adminNotes: String,
  approvedBy: mongoose.Schema.Types.ObjectId, // 审批人
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  processedAt: Date,
  completedAt: Date,
  
  // 索引优化
}, { 
  indexes: [
    { userId: 1, createdAt: -1 },
    { type: 1, status: 1 },
    { 'stripe.paymentIntentId': 1 },
    { 'crypto.txHash': 1 }
  ]
});

// 虚拟字段：净额（amount - fee）
transactionSchema.virtual('netAmount').get(function() {
  return this.amount - this.fee;
});

// 方法：标记为完成
transactionSchema.methods.markComplete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
};

// 方法：标记为失败
transactionSchema.methods.markFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
};

// 方法：申请退款
transactionSchema.methods.initiateRefund = function(reason) {
  this.status = 'disputed';
  this.failureReason = reason;
  this.refundRequested = true;
};

export default mongoose.model('Transaction', transactionSchema);
