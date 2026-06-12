import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

// 游戏模型（临时，可扩展到单独文件）
const gameSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ['slot', 'table', 'sports', 'live'] },
  provider: String, // pragmatic, pgsoft, evolution 等
  minBet: Number,
  maxBet: Number,
  rtp: Number, // Return to Player %
  volatility: String,
  image: String,
  active: { type: Boolean, default: true },
  playCount: { type: Number, default: 0 }
}, { timestamps: true });

// 投注模型
const betSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  amount: { type: Number, required: true, min: 1 },
  multiplier: Number, // 赔率
  potential_win: Number, // 潜在赢利
  result: {
    status: { type: String, enum: ['pending', 'won', 'lost', 'cancelled'], default: 'pending' },
    winAmount: { type: Number, default: 0 },
    lossAmount: { type: Number, default: 0 },
    resultTimestamp: Date
  },
  gameData: {
    sessionId: String,
    roundId: String,
    spins: [Object], // 老虎机转轮数据等
    cards: [String], // 纸牌游戏数据
    diceResults: [Number] // 骰子结果
  },
  metadata: {
    ip: String,
    userAgent: String,
    country: String,
    device: String
  },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date
}, { 
  indexes: [
    { userId: 1, createdAt: -1 },
    { status: 1, result: 1 }
  ]
});

const Game = mongoose.model('Game', gameSchema);
const Bet = mongoose.model('Bet', betSchema);

export class GameService {
  
  // ============ 游戏列表 ============
  
  static async getGames(filters = {}) {
    try {
      const query = { active: true };
      
      if (filters.type) query.type = filters.type;
      if (filters.provider) query.provider = filters.provider;
      
      const games = await Game.find(query)
        .sort({ playCount: -1 })
        .limit(filters.limit || 20)
        .skip(filters.skip || 0);
      
      const total = await Game.countDocuments(query);
      
      return {
        games,
        total,
        pages: Math.ceil(total / (filters.limit || 20))
      };
    } catch (error) {
      throw error;
    }
  }
  
  static async getGameById(gameId) {
    try {
      return await Game.findById(gameId);
    } catch (error) {
      throw error;
    }
  }
  
  // ============ 投注处理 ============
  
  static async placeBet(userId, gameId, amount, metadata = {}) {
    try {
      const user = await User.findById(userId);
      const game = await Game.findById(gameId);
      
      if (!user || !game) {
        throw new Error('Invalid user or game');
      }
      
      // 检查余额
      if (user.balance < amount) {
        throw new Error('Insufficient balance');
      }
      
      // 检查投注限制
      if (amount < game.minBet || amount > game.maxBet) {
        throw new Error(`Bet must be between ${game.minBet} and ${game.maxBet}`);
      }
      
      // 检查账户状态
      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }
      
      // 检查 KYC
      if (user.kyc.status !== 'verified') {
        throw new Error('KYC verification required');
      }
      
      // 扣除投注金额
      user.balance -= amount;
      user.vip.totalBets += amount;
      
      // 更新 VIP 等级
      this.updateVIPLevel(user);
      
      await user.save();
      
      // 创建投注记录
      const bet = new Bet({
        userId,
        gameId,
        amount,
        multiplier: this.generateMultiplier(game),
        potential_win: amount * this.generateMultiplier(game),
        metadata: {
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          country: metadata.country,
          device: metadata.device
        }
      });
      
      await bet.save();
      
      // 记录交易
      const transaction = new Transaction({
        userId,
        type: 'bet_placed',
        amount,
        currency: 'USD',
        relatedBetId: bet._id,
        relatedGameId: gameId,
        status: 'completed',
        description: `Bet placed on ${game.name}`,
        ipAddress: metadata.ip
      });
      
      await transaction.save();
      
      // 增加游戏播放次数
      game.playCount++;
      await game.save();
      
      return {
        betId: bet._id,
        gameId,
        amount,
        multiplier: bet.multiplier,
        potential_win: bet.potential_win,
        remaining_balance: user.balance
      };
    } catch (error) {
      throw error;
    }
  }
  
  // ============ 投注结果处理 ============
  
  static async resolveBet(betId, result) {
    try {
      const bet = await Bet.findById(betId).populate('userId');
      
      if (!bet) {
        throw new Error('Bet not found');
      }
      
      if (bet.result.status !== 'pending') {
        throw new Error('Bet already resolved');
      }
      
      const user = bet.userId;
      const isWin = result.won;
      
      // 计算赢利
      let winAmount = 0;
      if (isWin) {
        winAmount = Math.round(bet.amount * bet.multiplier * 100) / 100; // 保留 2 位小数
        user.balance += winAmount;
      }
      
      // 更新投注结果
      bet.result.status = isWin ? 'won' : 'lost';
      bet.result.winAmount = winAmount;
      bet.result.lossAmount = isWin ? 0 : bet.amount;
      bet.result.resultTimestamp = new Date();
      bet.result.gameData = result.gameData || {};
      bet.resolvedAt = new Date();
      
      await bet.save();
      await user.save();
      
      // 记录结果交易
      const transaction = new Transaction({
        userId: user._id,
        type: isWin ? 'bet_won' : 'bet_lost',
        amount: isWin ? winAmount : 0,
        currency: 'USD',
        relatedBetId: bet._id,
        status: 'completed',
        description: `${isWin ? 'Won' : 'Lost'} ${bet.amount} on bet`,
        ipAddress: bet.metadata.ip
      });
      
      await transaction.save();
      
      return {
        betId: bet._id,
        result: bet.result.status,
        winAmount,
        newBalance: user.balance
      };
    } catch (error) {
      throw error;
    }
  }
  
  // ============ 投注历史 ============
  
  static async getBetHistory(userId, limit = 50, skip = 0) {
    try {
      const bets = await Bet.find({ userId })
        .populate('gameId', 'name type provider')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
      
      const total = await Bet.countDocuments({ userId });
      
      return {
        bets,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw error;
    }
  }
  
  // ============ 统计信息 ============
  
  static async getUserGameStats(userId) {
    try {
      const stats = await Bet.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalBets: { $sum: '$amount' },
            totalWins: {
              $sum: {
                $cond: [{ $eq: ['$result.status', 'won'] }, '$result.winAmount', 0]
              }
            },
            totalLosses: {
              $sum: {
                $cond: [{ $eq: ['$result.status', 'lost'] }, '$amount', 0]
              }
            },
            winCount: {
              $sum: { $cond: [{ $eq: ['$result.status', 'won'] }, 1, 0] }
            },
            lossCount: {
              $sum: { $cond: [{ $eq: ['$result.status', 'lost'] }, 1, 0] }
            },
            totalBetCount: { $sum: 1 }
          }
        }
      ]);
      
      if (stats.length === 0) {
        return {
          totalBets: 0,
          totalWins: 0,
          totalLosses: 0,
          winRate: 0,
          profit: 0,
          totalBetCount: 0
        };
      }
      
      const data = stats[0];
      return {
        totalBets: data.totalBets,
        totalWins: data.totalWins,
        totalLosses: data.totalLosses,
        winCount: data.winCount,
        lossCount: data.lossCount,
        winRate: ((data.winCount / data.totalBetCount) * 100).toFixed(2),
        profit: data.totalWins - data.totalLosses,
        totalBetCount: data.totalBetCount
      };
    } catch (error) {
      throw error;
    }
  }
  
  // ============ 辅助方法 ============
  
  static generateMultiplier(game) {
    // 基于 RTP 和波动率生成赔率
    // 这是简化版本，实际应使用更复杂的算法
    const baseMultiplier = 1 + (100 - game.rtp) / 100;
    
    if (game.volatility === 'high') {
      return baseMultiplier * (0.5 + Math.random() * 2);
    } else if (game.volatility === 'medium') {
      return baseMultiplier * (0.8 + Math.random() * 1.2);
    } else {
      return baseMultiplier * (0.95 + Math.random() * 0.1);
    }
  }
  
  static updateVIPLevel(user) {
    // 根据总投注额更新 VIP 等级
    const levels = [
      { level: 0, requirement: 0, bonus: 0 },
      { level: 1, requirement: 1000, bonus: 0.02 },
      { level: 2, requirement: 5000, bonus: 0.05 },
      { level: 3, requirement: 10000, bonus: 0.08 },
      { level: 4, requirement: 50000, bonus: 0.10 },
      { level: 5, requirement: 100000, bonus: 0.12 }
    ];
    
    for (const level of levels.reverse()) {
      if (user.vip.totalBets >= level.requirement) {
        user.vip.level = level.level;
        user.vip.bonusPercentage = level.bonus;
        return;
      }
    }
  }
  
  // ============ 管理员函数 ============
  
  static async createGame(gameData) {
    try {
      const game = new Game(gameData);
      await game.save();
      return game;
    } catch (error) {
      throw error;
    }
  }
  
  static async updateGame(gameId, updates) {
    try {
      return await Game.findByIdAndUpdate(gameId, updates, { new: true });
    } catch (error) {
      throw error;
    }
  }
  
  static async deleteGame(gameId) {
    try {
      return await Game.findByIdAndDelete(gameId);
    } catch (error) {
      throw error;
    }
  }
  
  // ============ 防作弊和风险检测 ============
  
  static async checkFraud(userId, betAmount) {
    try {
      // 检查异常投注模式
      const recentBets = await Bet.find({
        userId,
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // 最近 1 小时
      });
      
      const totalAmount = recentBets.reduce((sum, bet) => sum + bet.amount, 0);
      
      // 如果 1 小时内的投注总额超过账户余额的 10 倍，标记为可疑
      const user = await User.findById(userId);
      
      if (totalAmount > user.balance * 10) {
        return {
          flagged: true,
          reason: 'Unusual betting pattern',
          score: 0.8
        };
      }
      
      return {
        flagged: false,
        reason: 'Normal',
        score: 0.1
      };
    } catch (error) {
      throw error;
    }
  }
}

export { Game, Bet };
