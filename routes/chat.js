import express from 'express';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';
import { io } from '../server.js';

// ============ 模型 ============

const chatMessageSchema = new mongoose.Schema({
  conversationId: mongoose.Schema.Types.ObjectId,
  senderId: mongoose.Schema.Types.ObjectId,
  senderType: { type: String, enum: ['user', 'support'], required: true },
  senderName: String,
  message: String,
  attachment: String,
  attachmentType: String,
  isRead: { type: Boolean, default: false },
  readAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  supportAgentId: mongoose.Schema.Types.ObjectId,
  subject: String,
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  category: String,
  lastMessage: String,
  lastMessageAt: Date,
  estimatedResolutionTime: Date,
  satisfactionRating: { type: Number, min: 1, max: 5 },
  feedback: String,
  messages: [chatMessageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  closedAt: Date
});

const Conversation = mongoose.model('Conversation', conversationSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

// ============ Socket.IO 实时聊天 ============

export function initializeLiveChat(io) {
  
  // 维护在线客服队列
  const supportAgents = new Map();
  const userSockets = new Map();
  const conversationRooms = new Map();

  io.on('connection', (socket) => {
    console.log(`[Chat] User connected: ${socket.id}`);

    // 用户加入聊天
    socket.on('user_join_chat', async (data) => {
      try {
        const { userId, subject, category } = data;
        
        // 创建或获取对话
        let conversation = await Conversation.findOne({
          userId,
          status: { $in: ['open', 'in_progress'] }
        });

        if (!conversation) {
          conversation = new Conversation({
            userId,
            subject,
            category,
            status: 'open'
          });
          await conversation.save();
        }

        // 标记用户为在线
        userSockets.set(userId, socket.id);
        socket.join(`conversation_${conversation._id}`);
        conversationRooms.set(socket.id, conversation._id);

        // 获取对话历史
        const messages = await ChatMessage.find({
          conversationId: conversation._id
        }).limit(50);

        socket.emit('chat_history', {
          conversationId: conversation._id,
          messages: messages.map(m => ({
            _id: m._id,
            senderType: m.senderType,
            senderName: m.senderName,
            message: m.message,
            createdAt: m.createdAt
          }))
        });

        // 通知支持团队有新用户
        if (conversation.status === 'open' && !conversation.supportAgentId) {
          io.to('support_team').emit('new_conversation_pending', {
            conversationId: conversation._id,
            userId,
            subject,
            category,
            priority: conversation.priority
          });
        }

        socket.emit('chat_connected', {
          conversationId: conversation._id,
          message: 'Welcome to our chat support!'
        });
      } catch (error) {
        socket.emit('chat_error', { error: error.message });
      }
    });

    // 接收用户消息
    socket.on('user_message', async (data) => {
      try {
        const { conversationId, message } = data;
        
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return socket.emit('chat_error', { error: 'Conversation not found' });
        }

        // 保存消息
        const chatMessage = new ChatMessage({
          conversationId,
          senderId: conversation.userId,
          senderType: 'user',
          message,
          createdAt: new Date()
        });

        await chatMessage.save();

        // 广播消息给对话中的所有人
        io.to(`conversation_${conversationId}`).emit('new_message', {
          _id: chatMessage._id,
          conversationId,
          senderType: 'user',
          message,
          createdAt: chatMessage.createdAt
        });

        // 更新对话
        conversation.lastMessage = message;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        // 如果没有支持代理，显示自动回复
        if (!conversation.supportAgentId) {
          setTimeout(async () => {
            const autoReply = await getAutoReply(message);
            
            const autoMessage = new ChatMessage({
              conversationId,
              senderType: 'support',
              senderName: 'Support Bot',
              message: autoReply,
              createdAt: new Date()
            });

            await autoMessage.save();

            io.to(`conversation_${conversationId}`).emit('new_message', {
              _id: autoMessage._id,
              conversationId,
              senderType: 'support',
              senderName: 'Support Bot',
              message: autoReply,
              createdAt: autoMessage.createdAt
            });
          }, 1000);
        }
      } catch (error) {
        socket.emit('chat_error', { error: error.message });
      }
    });

    // 支持代理加入
    socket.on('support_agent_join', async (data) => {
      try {
        const { agentId } = data;
        
        supportAgents.set(agentId, {
          socketId: socket.id,
          status: 'available',
          activeConversations: []
        });

        socket.join('support_team');
        socket.emit('support_connected', { message: 'Connected to support system' });
      } catch (error) {
        socket.emit('chat_error', { error: error.message });
      }
    });

    // 支持代理接受对话
    socket.on('support_accept_conversation', async (data) => {
      try {
        const { conversationId, agentId } = data;
        
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return socket.emit('chat_error', { error: 'Conversation not found' });
        }

        // 分配支持代理
        conversation.supportAgentId = agentId;
        conversation.status = 'in_progress';
        await conversation.save();

        // 加入对话房间
        socket.join(`conversation_${conversationId}`);

        // 通知用户有支持代理已接受
        io.to(`conversation_${conversationId}`).emit('agent_joined', {
          agentId,
          message: 'A support agent has joined the conversation'
        });

        // 获取对话历史
        const messages = await ChatMessage.find({
          conversationId
        });

        socket.emit('chat_history', {
          conversationId,
          messages
        });
      } catch (error) {
        socket.emit('chat_error', { error: error.message });
      }
    });

    // 支持代理发送消息
    socket.on('support_message', async (data) => {
      try {
        const { conversationId, message, agentId, agentName } = data;
        
        const chatMessage = new ChatMessage({
          conversationId,
          senderId: agentId,
          senderType: 'support',
          senderName: agentName,
          message,
          createdAt: new Date()
        });

        await chatMessage.save();

        io.to(`conversation_${conversationId}`).emit('new_message', {
          _id: chatMessage._id,
          conversationId,
          senderType: 'support',
          senderName: agentName,
          message,
          createdAt: chatMessage.createdAt
        });
      } catch (error) {
        socket.emit('chat_error', { error: error.message });
      }
    });

    // 关闭对话
    socket.on('close_conversation', async (data) => {
      try {
        const { conversationId } = data;
        
        const conversation = await Conversation.findById(conversationId);
        conversation.status = 'closed';
        conversation.closedAt = new Date();
        await conversation.save();

        io.to(`conversation_${conversationId}`).emit('conversation_closed', {
          message: 'Conversation has been closed'
        });
      } catch (error) {
        socket.emit('chat_error', { error: error.message });
      }
    });

    // 断开连接
    socket.on('disconnect', () => {
      const conversationId = conversationRooms.get(socket.id);
      if (conversationId) {
        conversationRooms.delete(socket.id);
      }
      
      console.log(`[Chat] User disconnected: ${socket.id}`);
    });
  });
}

// ============ 自动回复 ============

async function getAutoReply(userMessage) {
  const message = userMessage.toLowerCase();

  const autoReplies = {
    // 充值相关
    deposit: '感谢您的提问！我们支持多种充值方式：USDT、Alipay、WeChat Pay、ABA Pay 等。请访问充值页面了解更多信息。',
    
    // 提现相关
    withdraw: '提现需要完成 KYC 身份认证。提现申请通常在 24-48 小时内处理。',
    
    // 账户问题
    account: '如有账户问题，请确保您的密码安全。我们随时准备帮助您！',
    
    // 游戏相关
    game: '我们提供各种热门游戏。请访问游戏页面查看完整列表。',
    
    // 默认回复
    default: '感谢您的联系！我们的支持团队正在为您服务。请稍候...'
  };

  // 关键词匹配
  for (const [keyword, reply] of Object.entries(autoReplies)) {
    if (message.includes(keyword)) {
      return reply;
    }
  }

  return autoReplies.default;
}

// ============ REST API 路由 ============

const router = express.Router();

// 获取对话列表
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { status = 'all', limit = 20, page = 1 } = req.query;

    const query = { userId };
    if (status !== 'all') {
      query.status = status;
    }

    const conversations = await Conversation.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Conversation.countDocuments(query);

    res.json({
      success: true,
      conversations,
      total,
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个对话
router.get('/conversation/:id', authMiddleware, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation || conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await ChatMessage.find({
      conversationId: req.params.id
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      conversation,
      messages
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建新对话
router.post('/conversation', authMiddleware, async (req, res) => {
  try {
    const { subject, category } = req.body;
    const userId = req.user._id;

    const conversation = new Conversation({
      userId,
      subject,
      category,
      status: 'open'
    });

    await conversation.save();

    res.status(201).json({
      success: true,
      conversation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 发送消息
router.post('/conversation/:id/message', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const chatMessage = new ChatMessage({
      conversationId,
      senderId: req.user._id,
      senderType: 'user',
      message
    });

    await chatMessage.save();

    // 通过 Socket.IO 广播消息
    io.to(`conversation_${conversationId}`).emit('new_message', {
      _id: chatMessage._id,
      senderType: 'user',
      message,
      createdAt: chatMessage.createdAt
    });

    res.json({
      success: true,
      message: chatMessage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 关闭对话
router.post('/conversation/:id/close', authMiddleware, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation || conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    conversation.status = 'closed';
    conversation.closedAt = new Date();
    await conversation.save();

    res.json({
      success: true,
      message: 'Conversation closed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 提交满意度评分
router.post('/conversation/:id/rating', authMiddleware, async (req, res) => {
  try {
    const { rating, feedback } = req.body;

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || conversation.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    conversation.satisfactionRating = rating;
    conversation.feedback = feedback;
    await conversation.save();

    res.json({
      success: true,
      message: 'Rating submitted'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as chatRouter, initializeLiveChat, Conversation, ChatMessage };
