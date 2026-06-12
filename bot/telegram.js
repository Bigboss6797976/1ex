import { Telegraf, Markup } from 'telegraf';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { Bet } from '../services/GameService.js';
import mongoose from 'mongoose';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ============ 中间件 ============

// 检查是否为管理员
const isAdmin = async (ctx) => {
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  return ctx.message.chat.id.toString() === adminChatId;
};

// 日志记录
bot.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`[Telegram] ${ctx.message?.text || ctx.callbackQuery?.data} - ${ms}ms`);
});

// ============ 用户命令 ============

// /start - 开始使用
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💰 余额', 'balance')],
    [Markup.button.callback('📊 统计', 'stats')],
    [Markup.button.callback('📝 交易历史', 'history')],
    [Markup.button.callback('⚙️ 设置', 'settings')]
  ]);

  await ctx.reply(
    `🎉 欢迎使用 1xBet Bot!\n\n` +
    `用户 ID: \`${userId}\`\n\n` +
    `快速导航:`,
    keyboard
  );
});

// /balance - 查看余额
bot.command('balance', async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    
    // TODO: 建立 User 和 Telegram ID 的映射
    // 这里假设已有关联
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('❌ 未找到你的账户。请先在平台上完成注册。');
    }

    const message = 
      `💰 账户余额\n\n` +
      `余额: $${user.balance.toFixed(2)}\n` +
      `总充值: $${user.totalDeposited.toFixed(2)}\n` +
      `总提现: $${user.totalWithdrawn.toFixed(2)}\n` +
      `VIP 等级: ${user.vip.level}\n` +
      `KYC 状态: ${user.kyc.status}`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Balance command error:', error);
    await ctx.reply('❌ 获取余额失败，请稍后重试。');
  }
});

// /history - 交易历史
bot.command('history', async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('❌ 未找到你的账户。');
    }

    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    if (transactions.length === 0) {
      return ctx.reply('📭 暂无交易历史。');
    }

    let message = `📝 最近 5 笔交易:\n\n`;
    
    transactions.forEach((tx, index) => {
      const date = new Date(tx.createdAt).toLocaleDateString('zh-CN');
      const type = {
        'deposit': '💳 充值',
        'withdrawal': '💸 提现',
        'bet_placed': '🎮 下注',
        'bet_won': '🎉 赢注',
        'bet_lost': '😞 输注'
      }[tx.type] || tx.type;

      message += `${index + 1}. ${type} $${tx.amount} (${tx.status}) - ${date}\n`;
    });

    await ctx.reply(message);
  } catch (error) {
    console.error('History command error:', error);
    await ctx.reply('❌ 获取历史记录失败。');
  }
});

// /stats - 统计信息
bot.command('stats', async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return ctx.reply('❌ 未找到你的账户。');
    }

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
          },
          totalWinAmount: {
            $sum: {
              $cond: [
                { $eq: ['$result.status', 'won'] },
                '$result.winAmount',
                0
              ]
            }
          }
        }
      }
    ]);

    if (betStats.length === 0) {
      return ctx.reply('📊 暂无投注数据。');
    }

    const stats = betStats[0];
    const winRate = ((stats.winCount / stats.betCount) * 100).toFixed(1);
    const profit = (stats.totalWinAmount - stats.totalBets).toFixed(2);

    const message = 
      `📊 投注统计\n\n` +
      `总投注额: $${stats.totalBets.toFixed(2)}\n` +
      `投注次数: ${stats.betCount}\n` +
      `获胜次数: ${stats.winCount}\n` +
      `胜率: ${winRate}%\n` +
      `总赢利: $${stats.totalWinAmount.toFixed(2)}\n` +
      `净利润: $${profit}`;

    await ctx.reply(message);
  } catch (error) {
    console.error('Stats command error:', error);
    await ctx.reply('❌ 获取统计信息失败。');
  }
});

// ============ 管理员命令 ============

// /admin - 管理员菜单
bot.command('admin', async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.reply('❌ 只有管理员可以使用此命令。');
  }

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('👥 用户数', 'admin_users_count')],
    [Markup.button.callback('💰 平台余额', 'admin_balance')],
    [Markup.button.callback('⏳ 待审批', 'admin_pending')],
    [Markup.button.callback('🚨 风险账户', 'admin_risk')],
    [Markup.button.callback('📊 日报表', 'admin_daily_report')]
  ]);

  await ctx.reply('🔧 管理员面板:', keyboard);
});

// ============ 回调处理 ============

bot.action('balance', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.command_handlers['balance'][0](ctx);
});

bot.action('stats', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.command_handlers['stats'][0](ctx);
});

bot.action('history', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.command_handlers['history'][0](ctx);
});

bot.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔔 通知设置', 'notification_settings')],
    [Markup.button.callback('🌐 语言', 'language_settings')],
    [Markup.button.callback('返回', 'back')]
  ]);

  await ctx.editMessageText('⚙️ 设置菜单:', keyboard);
});

// 管理员统计回调
bot.action('admin_users_count', async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.answerCbQuery('❌ 无权限', true);
  }

  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const kycVerified = await User.countDocuments({ 'kyc.status': 'verified' });
    const kycPending = await User.countDocuments({ 'kyc.status': 'pending' });

    const message =
      `👥 用户统计\n\n` +
      `总用户数: ${totalUsers}\n` +
      `活跃用户: ${activeUsers}\n` +
      `KYC 已验证: ${kycVerified}\n` +
      `KYC 待审批: ${kycPending}`;

    await ctx.answerCbQuery();
    await ctx.editMessageText(message);
  } catch (error) {
    await ctx.answerCbQuery('❌ 获取数据失败', true);
  }
});

bot.action('admin_balance', async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.answerCbQuery('❌ 无权限', true);
  }

  try {
    const result = await User.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' },
          totalDeposits: { $sum: '$totalDeposited' },
          totalWithdrawals: { $sum: '$totalWithdrawn' }
        }
      }
    ]);

    if (result.length === 0) {
      return await ctx.answerCbQuery();
    }

    const stats = result[0];
    const platformBalance = (stats.totalDeposits - stats.totalWithdrawals).toFixed(2);

    const message =
      `💰 平台财务\n\n` +
      `用户总余额: $${stats.totalBalance.toFixed(2)}\n` +
      `总充值: $${stats.totalDeposits.toFixed(2)}\n` +
      `总提现: $${stats.totalWithdrawals.toFixed(2)}\n` +
      `平台净收益: $${platformBalance}`;

    await ctx.answerCbQuery();
    await ctx.editMessageText(message);
  } catch (error) {
    await ctx.answerCbQuery('❌ 获取数据失败', true);
  }
});

bot.action('admin_pending', async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.answerCbQuery('❌ 无权限', true);
  }

  try {
    const pendingCount = await Transaction.countDocuments({ status: 'pending' });
    const pendingKYC = await User.countDocuments({ 'kyc.status': 'pending' });

    const message =
      `⏳ 待审批事项\n\n` +
      `待处理交易: ${pendingCount}\n` +
      `待审核 KYC: ${pendingKYC}`;

    await ctx.answerCbQuery();
    await ctx.editMessageText(message);
  } catch (error) {
    await ctx.answerCbQuery('❌ 获取数据失败', true);
  }
});

bot.action('admin_risk', async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.answerCbQuery('❌ 无权限', true);
  }

  try {
    const riskyUsers = await User.find({
      'risk.status': { $in: ['suspicious', 'blocked'] }
    }).select('username email risk').limit(10);

    if (riskyUsers.length === 0) {
      await ctx.answerCbQuery();
      return await ctx.editMessageText('✅ 暂无风险账户');
    }

    let message = `🚨 风险账户 (${riskyUsers.length}):\n\n`;
    riskyUsers.forEach((user, i) => {
      message += `${i + 1}. ${user.username} - ${user.risk.status}\n`;
    });

    await ctx.answerCbQuery();
    await ctx.editMessageText(message);
  } catch (error) {
    await ctx.answerCbQuery('❌ 获取数据失败', true);
  }
});

bot.action('admin_daily_report', async (ctx) => {
  if (!await isAdmin(ctx)) {
    return ctx.answerCbQuery('❌ 无权限', true);
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await Transaction.aggregate([
      { $match: { createdAt: { $gte: today } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    let message = `📊 今日数据报表\n\n`;

    todayStats.forEach(stat => {
      const typeLabel = {
        'deposit': '💳 充值',
        'withdrawal': '💸 提现',
        'bet_placed': '🎮 投注',
        'bet_won': '🎉 赢注',
        'bet_lost': '😞 输注'
      }[stat._id] || stat._id;

      message += `${typeLabel}: $${stat.total.toFixed(2)} (${stat.count}笔)\n`;
    });

    await ctx.answerCbQuery();
    await ctx.editMessageText(message);
  } catch (error) {
    await ctx.answerCbQuery('❌ 获取数据失败', true);
  }
});

bot.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.command_handlers['start'][0](ctx);
});

// ============ 错误处理 ============

bot.catch((err, ctx) => {
  console.error(`❌ Telegram error for ${ctx.updateType}:`, err);
});

// ============ 启动 Bot ============

export async function startTelegramBot() {
  try {
    // 移除之前的 webhook（如果有）
    await bot.telegram.deleteWebhook();
    
    // 启动 polling 模式
    bot.launch({
      polling: {
        timeout: 30,
        allowed_updates: ['message', 'callback_query']
      }
    });

    console.log('✅ Telegram Bot started successfully');

    // 优雅关闭
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('❌ Telegram Bot error:', error);
    process.exit(1);
  }
}

// ============ 通知函数（供其他服务调用） ============

export const TelegramNotifier = {
  // 交易通知
  async notifyTransaction(userId, transaction, user) {
    try {
      if (!user.telegramId) return;

      const typeLabel = {
        'deposit': '💳 充值',
        'withdrawal': '💸 提现',
        'bet_placed': '🎮 下注',
        'bet_won': '🎉 赢注',
        'bet_lost': '😞 输注'
      }[transaction.type] || transaction.type;

      const statusLabel = {
        'completed': '✅ 已完成',
        'pending': '⏳ 待处理',
        'failed': '❌ 失败'
      }[transaction.status] || transaction.status;

      const message =
        `${typeLabel} 通知\n\n` +
        `金额: $${transaction.amount}\n` +
        `状态: ${statusLabel}\n` +
        `时间: ${new Date(transaction.createdAt).toLocaleString('zh-CN')}`;

      await bot.telegram.sendMessage(user.telegramId, message);
    } catch (error) {
      console.error('Failed to send transaction notification:', error);
    }
  },

  // KYC 更新通知
  async notifyKYCUpdate(userId, status) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.telegramId) return;

      const statusLabel = {
        'verified': '✅ 已验证',
        'rejected': '❌ 被拒绝',
        'pending': '⏳ 审核中'
      }[status] || status;

      const message = `KYC 身份认证状态更新: ${statusLabel}`;
      await bot.telegram.sendMessage(user.telegramId, message);
    } catch (error) {
      console.error('Failed to send KYC notification:', error);
    }
  },

  // 管理员通知
  async notifyAdmin(message) {
    try {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (!adminChatId) return;

      await bot.telegram.sendMessage(adminChatId, message);
    } catch (error) {
      console.error('Failed to send admin notification:', error);
    }
  }
};

export default bot;
