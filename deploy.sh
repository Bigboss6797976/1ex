#!/bin/bash

# 1xBet Platform - Railway 快速部署脚本
# 使用方法: bash deploy.sh

set -e

echo "🚀 1xBet Platform - Railway 一键部署"
echo "======================================"
echo ""

# 检查前置条件
echo "📋 检查前置条件..."

if ! command -v git &> /dev/null; then
    echo "❌ Git 未安装。请先安装 Git"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装。请先安装 Node.js 18+"
    exit 1
fi

echo "✅ Git 和 Node.js 已安装"
echo ""

# 检查或安装 Railway CLI
echo "📦 检查 Railway CLI..."
if ! command -v railway &> /dev/null; then
    echo "🔧 安装 Railway CLI..."
    npm install -g @railway/cli
else
    echo "✅ Railway CLI 已安装"
fi
echo ""

# Railway 登录
echo "🔐 Railway 登录..."
railway login
echo ""

# 初始化项目
echo "🎯 初始化 Railway 项目..."
if [ ! -d ".railway" ]; then
    railway init
fi
echo ""

# 获取 GitHub 仓库信息
echo "📝 GitHub 仓库配置..."
read -p "输入你的 GitHub 用户名: " github_username
read -p "输入仓库名称 (默认: 1xbet-platform): " repo_name
repo_name=${repo_name:-1xbet-platform}

# 推送到 GitHub（如果还没有）
if [ ! -d ".git" ]; then
    echo "🔗 初始化 Git 仓库..."
    git init
    git remote add origin https://github.com/$github_username/$repo_name.git
fi

echo ""
echo "⚙️ 配置环境变量..."
echo ""
echo "请输入以下 API 密钥（或按回车跳过）："
echo ""

# Stripe
read -p "Stripe Secret Key (sk_live_...): " stripe_secret
if [ ! -z "$stripe_secret" ]; then
    railway variables set STRIPE_SECRET_KEY=$stripe_secret
fi

read -p "Stripe Public Key (pk_live_...): " stripe_public
if [ ! -z "$stripe_public" ]; then
    railway variables set STRIPE_PUBLIC_KEY=$stripe_public
fi

read -p "Stripe Webhook Secret (whsec_...): " stripe_webhook
if [ ! -z "$stripe_webhook" ]; then
    railway variables set STRIPE_WEBHOOK_SECRET=$stripe_webhook
fi

echo ""

# TronGrid USDT
read -p "TronGrid API Key: " tron_key
if [ ! -z "$tron_key" ]; then
    railway variables set TRON_API_KEY=$tron_key
fi

echo ""

# MongoDB
read -p "MongoDB URI (mongodb+srv://...): " mongo_uri
if [ ! -z "$mongo_uri" ]; then
    railway variables set MONGODB_URI=$mongo_uri
fi

echo ""

# JWT
read -p "JWT Secret (自动生成): " jwt_secret
if [ -z "$jwt_secret" ]; then
    jwt_secret=$(openssl rand -hex 32)
fi
railway variables set JWT_SECRET=$jwt_secret

echo ""

# Telegram Bot（可选）
read -p "Telegram Bot Token (可选): " telegram_token
if [ ! -z "$telegram_token" ]; then
    railway variables set TELEGRAM_BOT_TOKEN=$telegram_token
fi

echo ""
echo "✅ 环境变量已设置"
echo ""

# 检查 docker-compose.yml
echo "📄 检查 docker-compose.yml..."
if [ ! -f "docker-compose.yml" ]; then
    echo "⚠️  docker-compose.yml 不存在，请确保项目结构完整"
    exit 1
fi

echo ""
echo "🔨 构建并测试本地环境..."

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "安装后端依赖..."
    npm install
fi

# 测试后端启动
echo "测试后端连接..."
npm run seed || true

echo ""
echo "🌐 配置 Railway 部署..."

# 创建 railway.json 配置
cat > railway.json << EOF
{
  "projectName": "1xbet-platform",
  "services": {
    "backend": {
      "builder": "dockerfile",
      "dockerfile": "Dockerfile-backend",
      "variables": {
        "NODE_ENV": "production",
        "PORT": "5000"
      }
    },
    "frontend": {
      "builder": "dockerfile",
      "dockerfile": "Dockerfile-frontend"
    }
  }
}
EOF

echo "✅ railway.json 已创建"
echo ""

# Git 提交
echo "📤 提交到 GitHub..."
git add .
git commit -m "Initial commit: 1xBet Platform complete setup" || true
git branch -M main
git push -u origin main || true

echo ""
echo "🚀 部署到 Railway..."
railway up

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 访问你的应用:"
echo "  前端: https://your-railway-domain.up.railway.app"
echo "  后端 API: https://your-railway-domain.up.railway.app/api"
echo ""
echo "📝 后续步骤:"
echo "  1. 验证 Stripe Webhook URL: https://your-railway-domain.up.railway.app/api/payment/stripe/webhook"
echo "  2. 配置 DNS 指向 Railway 域名"
echo "  3. 上传 SSL 证书（如果使用自定义域名）"
echo "  4. 测试支付流程"
echo ""
echo "💡 提示: 所有环境变量已在 Railway 仪表板中设置"
echo ""
