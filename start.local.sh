#!/bin/bash

echo "🚀 Bắt đầu thiết lập môi trường Local Development..."

# Kiểm tra xem Docker đã chạy chưa
echo "🐳 Đang kiểm tra trạng thái Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "❌ LỖI NGHIÊM TRỌNG: Docker chưa được khởi động hoặc máy không nhận diện lệnh docker!"
  echo "💡 Gợi ý: Hãy bật Docker Desktop hoặc chạy lệnh 'colima start' trước rồi thử lại nhé."
  exit 1
fi
echo "✅ Docker đang hoạt động."

# Kiểm tra Docker Compose
echo "🐳 Đang kiểm tra Docker Compose..."
if docker compose version > /dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif docker-compose --version > /dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "❌ LỖI NGHIÊM TRỌNG: Không tìm thấy lệnh 'docker compose' hoặc 'docker-compose'!"
  echo "💡 Gợi ý: Hãy cài đặt Docker Compose. Nếu dùng Colima, bạn có thể chạy 'brew install docker-compose'."
  exit 1
fi
echo "✅ Tìm thấy Docker Compose: $COMPOSE_CMD"

# 1. Kiểm tra và tạo file .env nếu chưa có
if [ ! -f .env ]; then
  echo "📝 Không tìm thấy file .env. Đang tự động tạo mới..."
  
  # Tạo secret key ngẫu nhiên
  JWT_SECRET=$(openssl rand -hex 32)
  
  cat <<EOF > .env
DATABASE_URL="postgres://denolith:denolith_password@127.0.0.1:5432/denolith_db"
DIRECT_URL="postgres://denolith:denolith_password@127.0.0.1:5432/denolith_db"
PORT=9999
DENO_ENV=development
JWT_SECRET="${JWT_SECRET}"
REDIS_URL="redis://127.0.0.1:6379"
EOF
  echo "✅ Đã tạo file .env thành công!"
else
  echo "ℹ️ Đã tìm thấy file .env. Bỏ qua tạo mới."
fi
# Lấy port từ .env (loại bỏ dấu nháy và khoảng trắng)
APP_PORT=$(grep -E "^PORT=" .env | cut -d '=' -f2 | tr -d ' "\r')
APP_PORT=${APP_PORT:-9999}

echo "🧹 Kiểm tra và dọn dẹp port $APP_PORT..."
OS="$(uname -s)"
if [ "$OS" = "Linux" ] || [ "$OS" = "Darwin" ]; then
  # MacOS hoặc Linux
  PIDs=$(lsof -t -i:$APP_PORT 2>/dev/null | tr '\n' ' ')
  if [ ! -z "$PIDs" ]; then
    echo "⚠️ Đang kill các tiến trình (PID: $PIDs) chiếm dụng port $APP_PORT..."
    kill -9 $PIDs
  else
    echo "✅ Port $APP_PORT đang trống."
  fi
elif echo "$OS" | grep -qE "CYGWIN|MINGW|MSYS"; then
  # Windows (Git Bash)
  PID=$(netstat -ano | grep ":$APP_PORT " | awk '{print $5}' | sed -n '1p')
  if [ ! -z "$PID" ] && [ "$PID" != "0" ]; then
    echo "⚠️ Đang kill tiến trình (PID: $PID) chiếm dụng port $APP_PORT trên Windows..."
    taskkill //PID $PID //F
  else
    echo "✅ Port $APP_PORT đang trống."
  fi
fi

# 2. Khởi động PostgreSQL và Redis
echo "🐳 Đang khởi động Database và Redis (compose.local.yml)..."
$COMPOSE_CMD -f compose.local.yml up -d

# Đợi một chút để Database sẵn sàng kết nối
echo "⏳ Chờ 3 giây để Database khởi động..."
sleep 3

# 3. Chạy Migrate và Seed (chỉ tạo bảng và seed nếu chưa có)
echo "🛠️ Đang kiểm tra và chạy Database Migrate..."
deno task migrate

echo "📦 Đang tạo Prisma Client..."
deno task prisma:generate

echo "🌱 Đang kiểm tra và chạy Seed dữ liệu mẫu..."
deno task seed

# 4. Khởi động server
echo "🔥 Đang khởi động Deno Dev Server..."
deno task dev
