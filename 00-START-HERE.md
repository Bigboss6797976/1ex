# 🚀 1xBet 平台 - 快速开始指南

## 📋 完整文件清单

### 后端文件 (Backend)
```
server.js                          ← 主服务器入口
models/
  ├── User.js                      ← 用户模型
  └── Transaction.js               ← 交易模型
services/
  ├── PaymentService.js            ← 支付处理（USDT/支付宝/微信/ABA/现金）
  ├── GameService.js               ← 游戏逻辑
  └── DigitalWalletService.js      ← Google Pay / Apple Pay
routes/
  ├── auth.js                      ← 认证（注册/登录/2FA）
  ├── payment.js                   ← 充值/提现
  ├── games.js                     ← 游戏投注
  ├── admin.js                     ← 管理后台
  └── chat.js                      ← 在线客服
bot/
  └── telegram.js                  ← Telegram Bot
locales/
  └── i18n.js                      ← 多语言（中/英/柬/越/泰）
```

### 前端文件 (Frontend)
```
pages/
  ├── App.jsx                      ← 路由主页
  ├── Profile.jsx                  ← 个人中心（4 个 Tab）
  ├── KYC.jsx                      ← 身份认证（4 步流程）
  ├── Games.jsx                    ← 游戏列表（下注弹窗）
  └── Deposit.jsx                  ← 充值页面
```

### 部署配置
```
docker-compose.yml                 ← 本地开发完整堆栈
Dockerfile-backend                 ← 后端镜像
Dockerfile-frontend                ← 前端镜像
nginx.conf                         ← 反向代理 + SPA 路由
deploy.sh                          ← Railway 一键部署脚本
.github-workflows-deploy.yml       ← GitHub Actions CI/CD
```

### 依赖文件
```
backend-package.json               ← 后端 npm 依赖
frontend-package.json              ← 前端 npm 依赖
.env.example                       ← 环境变量模板
```

---

## ⚡ 超快速开始（3 步）

### 第 1 步：克隆并配置

```bash
# 1. 克隆项目到本地
git clone <repo-url> 1xbet-platform
cd 1xbet-platform

# 2. 复制环境变量模板
cp .env.example .env

# 3. 编辑 .env 文件（填入你的 API 密钥）
nano .env
```

### .env 必填项：
```bash
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/1xbet

# JWT
JWT_SECRET=your-random-secret-key-here

# Stripe（可选，如果用信用卡支付）
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLIC_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# USDT TRC20（区块链）
TRON_API_KEY=your-tron-api-key

# 支付宝
ALIPAY_APP_ID=your-app-id

# 微信
WECHAT_MCH_ID=your-merchant-id

# ABA Pay（柬埔寨）
ABA_MERCHANT_ID=your-merchant-id

# Telegram Bot（可选）
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ADMIN_CHAT_ID=your-admin-id

# 银行账户（现金充值）
BANK_NAME=ABC Bank
BANK_ACCOUNT_NUMBER=123456789
```

### 第 2 步：启动应用

```bash
# 方式 A：Docker Compose（推荐 - 一键启动）
docker-compose up -d

# 等待 30 秒，然后访问：
# 前端: http://localhost:3000
# API:  http://localhost:5000/api
# 数据库: mongodb://localhost:27017/1xbet
# Redis:  localhost:6379
```

或

```bash
# 方式 B：本地 Node.js 开发
# 需要先装好：Node.js >= 16, MongoDB, Redis

# 后端
npm install -g nodemon
npm install
npm start

# 新开终端 - 前端
cd frontend
npm install
npm start
```

### 第 3 步：测试

```bash
# 1. 打开浏览器
http://localhost:3000

# 2. 点击右上角 "登录" 或 "注册"

# 3. 测试功能
  - 充值（Deposit）→ USDT/支付宝/微信/ABA/现金
  - 游戏（Games）→ 选游戏 → 下注 → 自动结算演示
  - 个人中心（Profile）→ 修改密码/语言/通知
  - KYC（身份认证）→ 4 步上传文件

# 4. 测试管理后台
http://localhost:5000/api/admin/users
（需要以管理员身份登录）

# 5. 测试 Telegram Bot
# 发送 /start 给你的 Bot
```

---

## 📁 项目结构

```
1xbet-platform/
├── server.js                    ← ⭐ 后端入口
├── pages/
│   ├── App.jsx                 ← ⭐ 前端入口（路由）
│   ├── Profile.jsx             ← 个人中心
│   ├── KYC.jsx                 ← 身份认证
│   ├── Games.jsx               ← 游戏列表
│   └── Deposit.jsx             ← 充值页面
├── models/                     ← 数据库模型
├── services/                   ← 业务逻辑
├── routes/                     ← API 路由
├── bot/                        ← Telegram Bot
├── locales/                    ← 多语言
├── docker-compose.yml          ← 本地开发
├── deploy.sh                   ← 云部署
├── .env.example                ← 配置模板
└── README.md                   ← 文档
```

---

## 🎯 核心 API 端点（样本）

### 认证
```
POST   /api/auth/register               注册
POST   /api/auth/login                  登录
POST   /api/auth/refresh-token          刷新 Token
```

### 支付
```
POST   /api/payment/usdt/generate-address   生成 USDT 地址
POST   /api/payment/ewallet/alipay          支付宝
POST   /api/payment/ewallet/wechat          微信支付
POST   /api/payment/ewallet/aba_pay         ABA Pay
POST   /api/payment/cash/deposit            现金充值
POST   /api/payment/withdrawal/request      提现
```

### 游戏
```
GET    /api/games/list                 游戏列表
POST   /api/games/:id/bet              下注
GET    /api/games/history              投注历史
```

### 用户
```
GET    /api/auth/me                    当前用户
GET    /api/user/profile               个人资料
PUT    /api/user/profile               更新资料
POST   /api/user/kyc/upload            上传 KYC
```

### 客服
```
GET    /api/chat/conversations         对话列表
POST   /api/chat/conversation/:id/message  发送消息
```

### 管理
```
GET    /api/admin/users                用户列表
GET    /api/admin/transactions         交易列表
GET    /api/admin/dashboard/stats      仪表板
```

---

## 🐳 Docker 命令速查

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止所有服务
docker-compose down

# 重启服务
docker-compose restart

# 进入 MongoDB
docker exec -it 1xbet-mongo mongosh

# 进入 Redis
docker exec -it 1xbet-redis redis-cli
```

---

## 🔐 账户测试

### 演示账户（默认）
```
用户名：testuser
邮箱：test@example.com
密码：Test1234!
```

### 管理员账户
```
邮箱：admin@example.com
密码：Admin1234!
```

---

## 📱 功能测试清单

- [ ] 注册新账户
- [ ] 邮箱验证
- [ ] 登录/登出
- [ ] 修改密码
- [ ] 头像上传（Profile）
- [ ] 充值（所有 5 种方式）
- [ ] 提现申请
- [ ] KYC 上传（4 步完成）
- [ ] 浏览游戏列表
- [ ] 下注游戏（自动结算演示）
- [ ] 查看投注历史
- [ ] 修改语言（5 种语言）
- [ ] 修改通知偏好
- [ ] 查看 VIP 等级
- [ ] Telegram Bot 命令
- [ ] 在线客服聊天
- [ ] 管理后台登录
- [ ] 查看用户列表
- [ ] 批准/拒绝交易

---

## 🚀 生产部署（Railway）

```bash
# 1. 安装 Railway CLI
npm i -g @railway/cli

# 2. 登录
railway login

# 3. 初始化项目
railway init

# 4. 添加 MongoDB（Cloud Atlas）
# 在 Railway 仪表板添加 MongoDB 连接字符串

# 5. 设置环境变量
railway variables

# 6. 部署
railway up

# 7. 查看 URL
railway status
```

或直接运行部署脚本：
```bash
bash deploy.sh
```

---

## 📞 常见问题 & 解决方案

### Q: 启动后无法连接数据库？
**A:** 检查 MongoDB 连接字符串
```bash
# 本地 MongoDB
MONGODB_URI=mongodb://localhost:27017/1xbet

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/1xbet
```

### Q: 端口被占用？
**A:** 修改 docker-compose.yml 中的端口映射
```yaml
ports:
  - "3001:3000"    # 改为 3001
  - "5001:5000"    # 改为 5001
```

### Q: 支付方式测试？
**A:** 每种方式有不同的测试流程
- **USDT** — 自动验证（TronGrid）
- **支付宝** — 会跳转到支付宝测试环境
- **微信** — 生成二维码（扫描测试）
- **ABA** — 跳转到 ABA 测试环境
- **现金** — 显示银行账户信息

### Q: 如何重置数据库？
```bash
# 停止应用
docker-compose down

# 删除数据卷
docker volume rm 1xbet-mongo-data

# 重启
docker-compose up -d
```

### Q: 如何查看日志？
```bash
# 后端日志
docker-compose logs -f backend

# 前端日志
docker-compose logs -f frontend

# 数据库日志
docker-compose logs -f mongo
```

---

## 📚 文件大小和性能

| 模块 | 大小 | 说明 |
|------|------|------|
| 后端代码 | ~3000 行 | 25+ API 端点 |
| 前端代码 | ~1500 行 | 4 个页面 |
| 总代码 | ~4500 行 | 完全可用 |
| 部署包 | ~5 MB | Docker 镜像 |

---

## 🎯 下一步建议

1. ✅ **立即启动** — `docker-compose up -d`
2. ✅ **测试功能** — 所有 19 个测试项
3. ✅ **配置 API** — Stripe/支付宝/微信/ABA
4. ✅ **定制化** — 修改品牌、颜色、文案
5. ✅ **上线部署** — Railway / Render / AWS
6. ✅ **监控日志** — 设置告警和通知

---

## 🔗 快速链接

- 本地前端: http://localhost:3000
- 本地 API: http://localhost:5000/api
- MongoDB: mongodb://localhost:27017
- Redis: localhost:6379
- Telegram Bot: @your_bot_handle

---

## ✨ 你现在拥有：

✅ 完整的博彩平台代码
✅ 5 种真实支付方式
✅ 用户认证 + KYC 系统
✅ 游戏投注和结算
✅ 管理后台
✅ Telegram Bot 通知
✅ 在线客服系统
✅ 5 种语言支持
✅ 生产级部署配置
✅ GitHub Actions CI/CD

---

**立即开始！** 🚀

```bash
docker-compose up -d
# 然后访问 http://localhost:3000
```

祝你部署顺利！

