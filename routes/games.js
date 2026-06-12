import express from 'express';
import { GameService, Game, Bet } from '../services/GameService.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// ============ 公开端点 ============

// 获取游戏列表
router.get('/list', async (req, res) => {
  try {
    const { type, provider, limit = 20, page = 1 } = req.query;
    
    const result = await GameService.getGames({
      type,
      provider,
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    });
    
    res.json({
      success: true,
      games: result.games,
      total: result.total,
      pages: result.pages,
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个游戏详情
router.get('/:id', async (req, res) => {
  try {
    const game = await GameService.getGameById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json({
      success: true,
      game
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 认证用户端点 ============

// 下注
router.post('/:id/bet', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const userId = req.user._id;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }
    
    // 检查欺诈
    const fraudCheck = await GameService.checkFraud(userId, amount);
    if (fraudCheck.flagged) {
      return res.status(403).json({ 
        error: 'Suspicious activity detected',
        reason: fraudCheck.reason
      });
    }
    
    const bet = await GameService.placeBet(userId, id, amount, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      country: 'Unknown' // TODO: 获取位置
    });
    
    res.json({
      success: true,
      message: 'Bet placed successfully',
      bet
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 获取投注历史
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const userId = req.user._id;
    
    const result = await GameService.getBetHistory(
      userId,
      parseInt(limit),
      (parseInt(page) - 1) * parseInt(limit)
    );
    
    res.json({
      success: true,
      bets: result.bets,
      total: result.total,
      pages: result.pages,
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个投注详情
router.get('/bet/:betId', authMiddleware, async (req, res) => {
  try {
    const bet = await Bet.findOne({
      _id: req.params.betId,
      userId: req.user._id
    }).populate('gameId');
    
    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }
    
    res.json({
      success: true,
      bet
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取游戏统计
router.get('/stats/personal', authMiddleware, async (req, res) => {
  try {
    const stats = await GameService.getUserGameStats(req.user._id);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 测试端点（模拟游戏结果） ============

// 模拟游戏完成（测试用）
router.post('/test/resolve-bet/:betId', authMiddleware, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' });
    }
    
    const bet = await Bet.findOne({
      _id: req.params.betId,
      userId: req.user._id
    });
    
    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }
    
    // 随机生成赢/输（50/50）
    const won = Math.random() > 0.5;
    
    const result = await GameService.resolveBet(req.params.betId, {
      won,
      gameData: {
        spins: [{ symbol: 'cherry' }, { symbol: '7' }, { symbol: 'bar' }]
      }
    });
    
    res.json({
      success: true,
      message: `Bet ${won ? 'won' : 'lost'}!`,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 管理员端点 ============

// 创建游戏
router.post('/admin/game', authMiddleware, async (req, res) => {
  try {
    // TODO: 检查管理员权限
    const { name, type, provider, minBet, maxBet, rtp, volatility, image } = req.body;
    
    const game = await GameService.createGame({
      name,
      type,
      provider,
      minBet,
      maxBet,
      rtp,
      volatility,
      image,
      active: true
    });
    
    res.status(201).json({
      success: true,
      message: 'Game created',
      game
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新游戏
router.put('/admin/game/:id', authMiddleware, async (req, res) => {
  try {
    // TODO: 检查管理员权限
    const game = await GameService.updateGame(req.params.id, req.body);
    
    res.json({
      success: true,
      message: 'Game updated',
      game
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除游戏
router.delete('/admin/game/:id', authMiddleware, async (req, res) => {
  try {
    // TODO: 检查管理员权限
    await GameService.deleteGame(req.params.id);
    
    res.json({
      success: true,
      message: 'Game deleted'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
