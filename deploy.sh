#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# CONDR Faceit — первичная установка на Ubuntu 22.04
# Запускать от root: bash deploy.sh yourdomain.com your@email.com
# ─────────────────────────────────────────────────────────────────────────────
set -e

DOMAIN=${1:?"Укажи домен: bash deploy.sh yourdomain.com your@email.com"}
EMAIL=${2:?"Укажи email для SSL: bash deploy.sh yourdomain.com your@email.com"}
APP_DIR="/opt/condr_faceit"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  CONDR Faceit — Production Setup                ║"
echo "╚══════════════════════════════════════════════════╝"
echo "  Домен: $DOMAIN"
echo "  Email: $EMAIL"
echo ""

# ── 1. Docker ─────────────────────────────────────────────────────────────────
echo "[1/6] Устанавливаю Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "  Docker уже установлен"
fi

if ! command -v docker compose &> /dev/null; then
  apt-get install -y docker-compose-plugin
fi

echo "  ✓ Docker $(docker --version)"

# ── 2. Копирование файлов ─────────────────────────────────────────────────────
echo "[2/6] Создаю папку приложения..."
mkdir -p "$APP_DIR"

if [ ! -f "$APP_DIR/docker-compose.prod.yml" ]; then
  echo "  Скопируй файлы проекта в $APP_DIR и запусти скрипт снова."
  echo ""
  echo "  На своём компе выполни:"
  echo "    scp -r C:/Users/Admin/Claude/condr_faceit/* root@SERVER_IP:$APP_DIR/"
  echo ""
  echo "  Или через git clone если проект в репозитории."
  exit 1
fi

cd "$APP_DIR"

# ── 3. .env.production ────────────────────────────────────────────────────────
echo "[3/6] Проверяю .env.production..."
if [ ! -f ".env.production" ]; then
  cp .env.production.example .env.production
  # Подставляю домен
  sed -i "s|PUBLIC_URL=.*|PUBLIC_URL=https://$DOMAIN|" .env.production
  echo ""
  echo "  ⚠️  ФАЙЛ .env.production СОЗДАН. Проверь его перед запуском:"
  echo "     nano $APP_DIR/.env.production"
  echo ""
  echo "  После редактирования запусти скрипт снова."
  exit 1
fi

echo "  ✓ .env.production найден"

# ── 4. nginx.conf — подставляю домен ─────────────────────────────────────────
echo "[4/6] Настраиваю nginx..."
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/nginx.conf
echo "  ✓ nginx.conf настроен для $DOMAIN"

# ── 5. SSL — первый запуск без HTTPS ─────────────────────────────────────────
echo "[5/6] Получаю SSL-сертификат..."

# Временно запускаем nginx только на 80 (без HTTPS блока) для certbot
# Через временный конфиг
cat > /tmp/nginx-certbot.conf << EOF
events { worker_connections 64; }
http {
  server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }
    location / { return 200 'ok'; }
  }
}
EOF

docker run -d --rm --name nginx-temp \
  -p 80:80 \
  -v /tmp/nginx-certbot.conf:/etc/nginx/nginx.conf:ro \
  -v certbot_www_vol:/var/www/certbot \
  nginx:1.25-alpine 2>/dev/null || true

sleep 3

docker run --rm \
  -v certbot_conf_vol:/etc/letsencrypt \
  -v certbot_www_vol:/var/www/certbot \
  certbot/certbot certonly \
    --webroot --webroot-path=/var/www/certbot \
    --non-interactive --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN"

docker stop nginx-temp 2>/dev/null || true

echo "  ✓ SSL получен"

# ── 6. Запуск приложения ──────────────────────────────────────────────────────
echo "[6/6] Поднимаю контейнеры..."

# Пробрасываю именованные volume на certbot (docker-compose видит их как certbot_www/certbot_conf)
# Переименовываем если нужно
docker volume create certbot_www 2>/dev/null || true
docker volume create certbot_conf 2>/dev/null || true

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

echo ""
echo "══════════════════════════════════════════════════"
echo "  ✅ Деплой завершён!"
echo "  Приложение: https://$DOMAIN"
echo ""
echo "  Полезные команды:"
echo "    Логи:         docker compose -f docker-compose.prod.yml logs -f"
echo "    Рестарт:      docker compose -f docker-compose.prod.yml restart"
echo "    Стоп:         docker compose -f docker-compose.prod.yml down"
echo "    Обновление:   git pull && docker compose -f docker-compose.prod.yml up -d --build"
echo "══════════════════════════════════════════════════"
