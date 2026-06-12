import express from 'express';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { Bet } from '../services/GameService.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// ============ 管理员权限检查中间件 ============

const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    
    // TODO: 添加 role 字段到 User 模型
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============ 用户管理 ============

// 获取所有用户
router.get('/users', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { limit = 50, page = 1, search, status } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      users,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户详情
router.get('/user/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 获取用户的交易记录摘要
    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    
    // 获取用户的投注统计
    const betStats = await Bet.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalBets: { $sum: '$amount' },
          betCount: { $sum: 1 },
          winCount: {
            $sum: { $cond: [{ $eq: ['$result.status', 'won'] }, 1, 0] }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      user,
      transactions: transactions.slice(0, 10),
      betStats: betStats[0] || { totalBets: 0, betCount: 0, winCount: 0 }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 编辑用户
router.put('/user/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { balance, vipLevel, status, note } = req.body;
    
    const updates = {};
    
    if (balance !== undefined) updates.balance = balance;
    if (vipLevel !== undefined) updates['vip.level'] = vipLevel;
    if (status !== undefined) updates.status = status;
    if (note !== undefined) updates.adminNotes = note;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).select('-password');
    
    res.json({
      success: true,
      message: 'User updated',
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 停用/恢复用户账户
router.post('/user/:id/suspend', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { reason, hours = 24 } = req.body;
    
    const user = await User.findById(req.params.id);
    
    user.status = 'suspended';
    user.suspendReason = reason;
    user.suspendUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    await user.save();
    
    res.json({
      success: true,
      message: `User suspended for ${hours} hours`,
      user: {
        _id: user._id,
        status: user.status,
        suspendUntil: user.suspendUntil
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 永久封禁用户
router.post('/user/:id/ban', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findById(req.params.id);
    
    user.status = 'banned';
    user.suspendReason = reason;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User banned',
      user: {
        _id: user._id,
        status: user.status
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 交易管理 ============

// 获取所有交易
router.get('/transactions', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { limit = 50, page = 1, status, type, userId } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (userId) query.userId = userId;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const transactions = await Transaction.find(query)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Transaction.countDocuments(query);
    
    res.json({
      success: true,
      transactions,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 审批/拒绝提现
router.post('/transaction/:id/approve', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Transaction already processed' });
    }
    
    transaction.status = 'completed';
    transaction.approvedBy = req.user._id;
    await transaction.save();
    
    res.json({
      success: true,
      message: 'Transaction approved',
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 拒绝交易
router.post('/transaction/:id/reject', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { reason } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    if (transaction.status !== 'pending') {
      return res.status(400).json({ error: 'Transaction already processed' });
    }
    
    transaction.status = 'failed';
    transaction.failureReason = reason;
    transaction.approvedBy = req.user._id;
    
    // 如果是提现被拒绝，返还余额
    if (transaction.type === 'withdrawal') {
      const user = await User.findById(transaction.userId);
      user.balance += transaction.amount;
      await user.save();
    }
    
    await transaction.save();
    
    res.json({
      success: true,
      message: 'Transaction rejected',
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 风险管理 ============

// 获取可疑账户
router.get('/risk/suspicious', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const users = await User.find({
      'risk.status': { $in: ['suspicious', 'blocked'] }
    }).select('-password').limit(100);
    
    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 标记用户为可疑
router.post('/risk/flag-user/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findById(req.params.id);
    
    user.risk.status = 'suspicious';
    user.risk.lastFlaggedAt = new Date();
    user.risk.flagReason = reason;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User flagged for review',
      user: {
        _id: user._id,
        risk: user.risk
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 解除风险标记
router.post('/risk/clear-flag/:id', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    user.risk.status = 'safe';
    user.risk.flagReason = null;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Risk flag cleared',
      user: {
        _id: user._id,
        risk: user.risk
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 报告和统计 ============

// 仪表板数据
router.get('/dashboard/stats', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const stats = {
      totalUsers: await User.countDocuments(),
      activeUsers: await User.countDocuments({ status: 'active' }),
      suspendedUsers: await User.countDocuments({ status: 'suspended' }),
      bannedUsers: await User.countDocuments({ status: 'banned' }),
      
      totalDeposits: await Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      totalWithdrawals: await Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      
      pendingWithdrawals: await Transaction.countDocuments({
        type: 'withdrawal',
        status: 'pending'
      }),
      
      totalBets: await Bet.countDocuments(),
      totalWinAmount: await Bet.aggregate([
        { $match: { 'result.status': 'won' } },
        { $group: { _id: null, total: { $sum: '$result.winAmount' } } }
      ]),
      
      suspiciousUsers: await User.countDocuments({
        'risk.status': 'suspicious'
      })
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 财务报告
router.get('/reports/financial', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const transactions = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      report: transactions,
      period: {
        from: startDate,
        to: endDate
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ KYC 审核 ============

// 获取待审核 KYC
router.get('/kyc/pending', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const users = await User.find({
      'kyc.status': 'pending'
    }).select('-password').limit(50);
    
    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批准 KYC
router.post('/kyc/:id/approve', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    user.kyc.status = 'verified';
    user.kyc.verifiedAt = new Date();
    
    await user.save();
    
    res.json({
      success: true,
      message: 'KYC approved',
      user: {
        _id: user._id,
        kyc: user.kyc
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 拒绝 KYC
router.post('/kyc/:id/reject', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);
    
    user.kyc.status = 'rejected';
    user.kyc.verifiedAt = new Date();
    
    await user.save();
    
    res.json({
      success: true,
      message: 'KYC rejected',
      reason,
      user: {
        _id: user._id,
        kyc: user.kyc
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
