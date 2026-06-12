import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import { validationResult, body } from 'express-validator';

const router = express.Router();

// ============ 注册 ============

router.post('/register', [
  body('username').isLength({ min: 3, max: 20 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('phone').optional().isMobilePhone()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, phone } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    // 创建新用户
    const user = new User({
      username,
      email,
      password,
      phone,
      preferences: {
        language: 'en',
        currency: 'USD'
      }
    });

    await user.save();

    // 生成 verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(verificationToken).digest();
    user.security.emailVerificationToken = hash;
    user.security.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // 发送验证邮件（TODO: 集成邮件服务）
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    console.log(`📧 验证邮件: ${verificationLink}`);

    // 生成 JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        kyc: user.kyc.status
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ 登录 ============

router.post('/login', [
  body('email').isEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // 查找用户
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 检查账户状态
    if (user.status === 'suspended' || user.status === 'banned') {
      return res.status(403).json({ 
        error: `Account is ${user.status}`,
        reason: user.suspendReason
      });
    }

    // 检查账户是否被锁定
    if (user.isLocked()) {
      return res.status(423).json({ 
        error: 'Account is locked. Try again later.',
        unlockTime: user.security.lockUntil
      });
    }

    // 验证密码
    const passwordMatch = await user.comparePassword(password);

    if (!passwordMatch) {
      // 记录失败尝试
      user.security.loginAttempts = (user.security.loginAttempts || 0) + 1;
      
      if (user.security.loginAttempts >= 3) {
        user.lockAccount(1); // 锁定 1 小时
        await user.save();
        return res.status(423).json({ 
          error: 'Too many failed login attempts. Account locked for 1 hour.'
        });
      }
      
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 登录成功 - 重置失败计数
    user.security.loginAttempts = 0;
    user.security.lockUntil = null;
    user.lastLogin = new Date();
    user.lastLoginIp = req.ip;
    
    // 记录登录历史
    user.loginHistory = user.loginHistory || [];
    user.loginHistory.push({
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date(),
      country: 'Unknown' // TODO: 获取国家信息
    });

    await user.save();

    // 检查 2FA
    if (user.security.twoFAEnabled) {
      // 发送 2FA 代码（邮件或短信）
      const twoFACode = Math.random().toString().slice(2, 8);
      console.log(`🔐 2FA Code: ${twoFACode}`);
      
      return res.json({
        success: true,
        message: '2FA verification required',
        requires2FA: true,
        tempToken: jwt.sign(
          { userId: user._id, temp: true },
          process.env.JWT_SECRET,
          { expiresIn: '10m' }
        )
      });
    }

    // 生成 JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        kyc: user.kyc.status,
        vip: user.vip.level
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ 邮箱验证 ============

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const hash = crypto.createHash('sha256').update(token).digest();
    
    const user = await User.findOne({
      'security.emailVerificationToken': hash,
      'security.emailVerificationExpires': { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    user.security.emailVerified = true;
    user.security.emailVerificationToken = undefined;
    user.security.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ 刷新 Token ============

router.post('/refresh-token', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid user' });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 获取当前用户信息 ============

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 登出 ============

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // 可以在这里添加 token 黑名单逻辑（使用 Redis）
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 2FA 验证 ============

router.post('/2fa/verify', async (req, res) => {
  try {
    const { code, tempToken } = req.body;

    // 验证临时 token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired 2FA token' });
    }

    if (!decoded.temp) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: 验证 2FA 代码（与存储的代码比较）
    // if (user.security.twoFACode !== code) {
    //   return res.status(401).json({ error: 'Invalid 2FA code' });
    // }

    // 生成正式 token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 修改密码 ============

router.post('/change-password', authMiddleware, [
  body('currentPassword').exists(),
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // 验证当前密码
    const passwordMatch = await user.comparePassword(currentPassword);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // 更新密码
    user.password = newPassword;
    user.security.passwordChangedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 忘记密码 ============

router.post('/forgot-password', [
  body('email').isEmail()
], async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // 出于安全考虑，不要透露邮箱是否存在
      return res.json({
        success: true,
        message: 'If the email exists, you will receive password reset instructions'
      });
    }

    // 生成重置令牌
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(resetToken).digest();

    user.security.passwordResetToken = hash;
    user.security.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 小时
    await user.save();

    // 发送重置邮件
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    console.log(`📧 密码重置链接: ${resetLink}`);

    res.json({
      success: true,
      message: 'If the email exists, you will receive password reset instructions'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 重置密码 ============

router.post('/reset-password', [
  body('token').exists(),
  body('password').isLength({ min: 8 })
], async (req, res) => {
  try {
    const { token, password } = req.body;
    const hash = crypto.createHash('sha256').update(token).digest();

    const user = await User.findOne({
      'security.passwordResetToken': hash,
      'security.passwordResetExpires': { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.security.passwordResetToken = undefined;
    user.security.passwordResetExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
