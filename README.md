# 1xBet Platform - Complete Real Money Payment System

完整的真实支付博彩平台，集成 Stripe、USDT TRC20、银行转账、电子钱包等多种支付方式。

---

## 🎯 核心特性

### 💳 支付系统（真实资金）
- ✅ **Stripe** - 信用卡/借记卡支付
- ✅ **USDT TRC20** - 区块链支付（TronGrid）
- ✅ **银行转账** - SWIFT/SEPA 国际电汇
- ✅ **电子钱包** - 支付宝、微信、OVO、GCash 等
- ✅ **自动对账** - Webhook 自动确认交易
- ✅ **提现管理** - 白名单、KYC、反洗钱（AML）

### 👤 用户管理
- ✅ JWT 身份认证
- ✅ KYC/AML 合规（文件上传、ID 验证）
- ✅ 2FA 双因素认证
- ✅ 账户安全（登录尝试限制、IP 白名单）
- ✅ VIP 等级系统（根据充值额自动升级）
- ✅ 推荐佣金系统

### 📊 仪表板和管理
- ✅ 用户仪表板（余额、历史记录、KYC 状态）
- ✅ 管理员后台（用户管理、交易审核、风险标记）
- ✅ 实时交易监控
- ✅ 报表和分析

### 🤖 Telegram Bot 管理
- ✅ 实时交易通知
- ✅ 用户管理命令
- ✅ 营运数据汇总

---

## 🚀 快速开始（Docker）

### 前置条件
- Docker & Docker Compose
- Node.js 18+
- MongoDB Atlas 或本地 MongoDB
- Stripe 账户（测试密钥）
- TronGrid API 密钥（USDT）
- Telegram Bot Token（可选）

### 1. 克隆和配置

```bash
git clone https://github.com/yourusername/1xbet-platform.git
cd 1xbet-platform

# 复制环境变量模板
cp .env.example .env

# 编辑 .env，填入你的 API 密钥
nano .env
```

### 2. 启动全堆栈

```bash
# 一键启动（MongoDB + Redis + Backend + Frontend + Nginx）
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 检查状态
docker-compose ps
```

### 3. 访问应用

```
前端: http://localhost:3000
API:  http://localhost:5000/api
Nginx: http://localhost:80
```

### 4. 初始化数据

```bash
# 进入后端容器
docker-compose exec backend bash

# 运行 seed 脚本（创建测试数据）
npm run seed
```

---

## 📋 环境变量配置

### Stripe 设置

1. 前往 [Stripe Dashboard](https://dashboard.stripe.com)
2. 获取 API Keys（测试模式）
3. 创建 Webhook Endpoint: `https://yourdomain.com/api/payment/stripe/webhook`
4. 复制 Webhook Secret

```env
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLIC_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### USDT TRC20 设置

1. 前往 [TronGrid](https://www.trongrid.io)
2. 注册并创建 API Key
3. 获取主网 RPC 端点

```env
TRON_API_KEY=your-tron-api-key
TRON_NETWORK_RPC=https://api.trongrid.io
```

### MongoDB 设置

#### 选项 A：MongoDB Atlas（云）- 推荐
1. 前往 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 创建免费集群
3. 获取连接字符串

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/1xbet-platform
```

#### 选项 B：本地 MongoDB
```bash
# 安装 MongoDB
brew install mongodb-community  # macOS
# 或 docker pull mongo

# Docker 启动
docker run -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:7.0
```

```env
MONGODB_URI=mongodb://admin:password@localhost:27017/1xbet-platform?authSource=admin
```

### JWT 密钥

```bash
# 生成安全密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
JWT_SECRET=your-generated-secret
JWT_EXPIRE=7d
```

---

## 🌐 生产部署

### 选项 1：Railway.app（推荐）

```bash
# 1. 安装 Railway CLI
npm install -g @railway/cli

# 2. 登录
railway login

# 3. 创建项目
railway init

# 4. 关联 GitHub 仓库
railway link

# 5. 设置环境变量
railway variables set STRIPE_SECRET_KEY=sk_live_xxxxx
railway variables set MONGODB_URI=mongodb+srv://...
# ... 其他变量

# 6. 部署
git push

# 自动部署完成！
```

### 选项 2：Render.com

```bash
# 1. 连接 GitHub 仓库到 Render
# 2. 创建两个 Web Services（Backend 和 Frontend）
# 3. 设置环境变量
# 4. 配置 MongoDB 和 Redis
# 5. 自动部署
```

### 选项 3：自建 VPS（AWS/DigitalOcean/Linode）

```bash
# 1. SSH 连接到服务器
ssh root@your-server-ip

# 2. 安装依赖
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/v2.0.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. 克隆仓库
git clone https://github.com/yourusername/1xbet-platform.git
cd 1xbet-platform

# 4. 配置环境变量
cp .env.example .env
nano .env

# 5. 启动
docker-compose -f docker-compose.prod.yml up -d

# 6. 配置 SSL（Let's Encrypt）
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d yourdomain.com
```

---

## 📱 API 文档

### 认证

#### 注册
```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",
  "password": "securepassword",
  "phone": "+1234567890"
}

Response:
{
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 登录
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### 支付

#### 创建 Stripe 支付意图
```bash
POST /api/payment/stripe/create-intent
Authorization: Bearer <token>
{
  "amount": 100,
  "currency": "usd"
}

Response:
{
  "clientSecret": "pi_xxxxx",
  "paymentIntentId": "pi_xxxxx",
  "amount": 100,
  "currency": "usd"
}
```

#### 生成 USDT 地址
```bash
POST /api/payment/usdt/generate-address
Authorization: Bearer <token>

Response:
{
  "address": "TYj...xyz",
  "network": "TRC20",
  "memo": "Deposit to user123",
  "qrCode": "https://..."
}
```

#### 请求提现
```bash
POST /api/payment/withdrawal/request
Authorization: Bearer <token>
{
  "amount": 500
}

Response:
{
  "transactionId": "txn_xxxxx",
  "amount": 500,
  "status": "pending",
  "estimatedTime": "24-48 hours"
}
```

#### 获取交易历史
```bash
GET /api/payment/transactions?limit=50&page=1
Authorization: Bearer <token>

Response:
{
  "transactions": [ ... ],
  "total": 120,
  "pages": 3,
  "currentPage": 1
}
```

#### 获取账户余额
```bash
GET /api/payment/balance
Authorization: Bearer <token>

Response:
{
  "balance": 2500.50,
  "currency": "USD",
  "totalDeposited": 5000,
  "totalWithdrawn": 2499.50
}
```

---

## 🔐 安全最佳实践

### 敏感数据加密
```javascript
// 银行账户号、钱包地址等需要加密存储
const encrypted = crypto.encrypt(data, process.env.ENCRYPTION_KEY);
await user.save();
```

### API 速率限制
```javascript
// 已配置 express-rate-limit
// 登录: 5 次尝试/15 分钟
// API: 100 次请求/15 分钟
```

### HTTPS 强制
```nginx
# nginx.conf 已配置
server {
  listen 443 ssl http2;
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
}
```

### KYC/AML 合规
- 文件上传验证（护照、身份证等）
- 金额限制（新用户）
- 异常活动检测
- 交易监控日志

### 登录安全
- 密码加密（bcrypt）
- JWT 过期时间设置
- 登录尝试限制（3 次失败后锁定 1 小时）
- IP 地址记录和审计

---

## 🧪 测试

### Stripe 测试卡号
```
4242 4242 4242 4242  - Visa（成功）
4000 0025 0000 3155  - Visa（需要 3D 认证）
5555 5555 5555 4444  - Mastercard（成功）
2223 0031 2200 3222  - Mastercard（成功）
```

### USDT 测试
使用 Tron 测试网络生成测试地址

---

## 📊 监控和日志

### Docker 日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 只看后端
docker-compose logs -f backend

# 只看最后 100 行
docker-compose logs --tail=100 backend
```

### MongoDB 监控
```bash
# 进入 MongoDB
docker-compose exec mongodb mongosh

# 查看数据库大小
db.stats()

# 查看集合
db.getCollectionNames()

# 查询交易
db.transactions.find({ status: 'pending' }).limit(10)
```

### 应用性能监控（APM）

推荐集成：
- **Datadog** - 完整 APM 解决方案
- **New Relic** - 实时监控
- **Sentry** - 错误追踪
- **LogRocket** - 前端会话回放

---

## 🐛 故障排除

### 问题 1：MongoDB 连接失败
```bash
# 检查 MongoDB 状态
docker-compose logs mongodb

# 验证连接字符串（特别是密码中的特殊字符）
# 使用 URL 编码：password@123 → password%40123

# 重启 MongoDB
docker-compose restart mongodb
```

### 问题 2：Stripe Webhook 收不到回调
```bash
# 1. 检查 Webhook Secret 是否正确
# 2. 检查防火墙是否阻止了 Stripe IP
# 3. 在 Stripe Dashboard 查看 Webhook 日志
# 4. 使用 ngrok 本地测试：
ngrok http 5000
# 将 ngrok URL 配置到 Stripe Webhook
```

### 问题 3：USDT 交易验证失败
```bash
# 检查 TronGrid API Key
# 检查交易是否真实存在：
curl "https://api.trongrid.io/v1/transaction/TX_HASH?TRON-PRO-API-KEY=YOUR_KEY"

# 检查网络（主网 vs 测试网）
```

### 问题 4：前端 API 调用 404
```bash
# 检查 Nginx 代理配置
docker-compose exec nginx cat /etc/nginx/nginx.conf

# 检查后端是否启动
docker-compose logs backend

# 检查 CORS 设置
```

---

## 📈 扩展和优化

### 数据库优化
```javascript
// 添加索引加快查询
db.transactions.createIndex({ userId: 1, createdAt: -1 })
db.users.createIndex({ email: 1 })
db.users.createIndex({ 'cryptoWallet.address': 1 })
```

### 缓存策略
```javascript
// 使用 Redis 缓存用户余额
const balance = await redis.get(`user:${userId}:balance`);
if (!balance) {
  const user = await User.findById(userId);
  await redis.setex(`user:${userId}:balance`, 3600, user.balance);
}
```

### 微服务拆分
- 支付服务（独立服务）
- 游戏服务（微服务）
- 用户服务（微服务）
- 通知服务（消息队列）

---

## 📞 支持和联系

- **文档**: https://docs.1xbet-platform.io
- **问题跟踪**: https://github.com/yourusername/issues
- **讨论**: https://github.com/yourusername/discussions
- **邮件**: support@yourdomain.com

---

## 📄 许可证

MIT License - 详见 LICENSE 文件

---

**最后更新**: 2024 年 6 月
**作者**: Your Development Team
**版本**: 1.0.0 ✅ 完整生产级
