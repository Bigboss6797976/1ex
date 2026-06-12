import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // 基础信息
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  
  // 真实资金账户（单位：USD/USDT）
  balance: { type: Number, default: 0, min: 0 }, // 当前余额
  totalDeposited: { type: Number, default: 0 }, // 总充值
  totalWithdrawn: { type: Number, default: 0 }, // 总提现
  
  // KYC（身份认证）
  kyc: {
    status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
    idType: String, // passport, driver_license, national_id
    idNumber: String,
    fullName: String,
    dateOfBirth: Date,
    country: String,
    address: String,
    city: String,
    postalCode: String,
    verifiedAt: Date,
    documents: [String] // 证件照片 URL
  },
  
  // 支付方式
  paymentMethods: [{
    _id: mongoose.Schema.Types.ObjectId,
    type: { type: String, enum: ['card', 'bank', 'crypto', 'ewallet'], required: true },
    provider: String, // stripe, wise, usdt, alipay, wechat
    cardLast4: String,
    bankName: String,
    accountNumber: String, // 加密存储
    walletAddress: String, // 加密存储
    isDefault: Boolean,
    addedAt: { type: Date, default: Date.now },
    verified: Boolean
  }],
  
  // 银行账户（用于提现）
  bankAccount: {
    accountHolder: String,
    bankName: String,
    accountNumber: String, // 加密
    swiftCode: String,
    routingNumber: String,
    iban: String,
    verified: Boolean,
    verifiedAt: Date
  },
  
  // 加密钱包（USDT TRC20）
  cryptoWallet: {
    address: String, // 加密
    network: { type: String, enum: ['TRC20', 'ERC20', 'BEP20'], default: 'TRC20' },
    verified: Boolean,
    verifiedAt: Date
  },
  
  // VIP等级（根据充值金额）
  vip: {
    level: { type: Number, default: 0, min: 0, max: 10 }, // 0-10 级
    totalBets: { type: Number, default: 0 }, // 总投注额
    status: { type: String, enum: ['inactive', 'active', 'gold', 'platinum'], default: 'inactive' },
    promotionalCode: String,
    bonusPercentage: { type: Number, default: 0 } // VIP 返水百分比
  },
  
  // 安全设置
  security: {
    twoFAEnabled: { type: Boolean, default: false },
    twoFASecret: String,
    passwordChangedAt: Date,
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    withdrawalWhitelist: [String] // 提现地址白名单
  },
  
  // 风险管理
  risk: {
    status: { type: String, enum: ['safe', 'suspicious', 'blocked'], default: 'safe' },
    lastFlaggedAt: Date,
    flagReason: String,
    amlStatus: { type: String, enum: ['pass', 'pending', 'failed'], default: 'pending' }
  },
  
  // 推荐系统
  referral: {
    code: String,
    referredBy: mongoose.Schema.Types.ObjectId, // 推荐者 ID
    commissionRate: { type: Number, default: 0.05 }, // 5% 提成
    totalCommission: { type: Number, default: 0 },
    referrals: [mongoose.Schema.Types.ObjectId] // 被推荐的用户
  },
  
  // 偏好设置
  preferences: {
    language: { type: String, default: 'en', enum: ['en', 'zh', 'vi', 'th', 'id'] },
    currency: { type: String, default: 'USD', enum: ['USD', 'USDT', 'EUR', 'CNY'] },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    timezone: String
  },
  
  // 登录信息
  lastLogin: Date,
  lastLoginIp: String,
  loginHistory: [{
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
    country: String
  }],
  
  // 状态
  status: { type: String, enum: ['active', 'suspended', 'banned', 'deleted'], default: 'active' },
  suspendReason: String,
  suspendUntil: Date,
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 加密密码
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 密码比较方法
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// 锁定账户（多次登录失败）
userSchema.methods.lockAccount = function(hours = 1) {
  this.security.lockUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  this.security.loginAttempts = 0;
};

userSchema.methods.isLocked = function() {
  return this.security.lockUntil && this.security.lockUntil > new Date();
};

export default mongoose.model('User', userSchema);
