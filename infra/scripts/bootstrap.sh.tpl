#!/bin/bash
# EC2 user_data bootstrap (Amazon Linux 2023). Idempotent — safe to re-run
# (e.g. on instance reboot / cloud-init retry) without reinstalling anything
# that's already present.
set -euxo pipefail

APP_DIR="/opt/opendispatch"
mkdir -p "$APP_DIR"

# ---------------------------------------------------------------------------
# 1. Docker — skip install if already present
# ---------------------------------------------------------------------------
if command -v docker &> /dev/null; then
  echo "Docker already installed, skipping."
else
  dnf update -y
  dnf install -y docker
  systemctl enable docker
  systemctl start docker
  usermod -aG docker ec2-user
fi

# Docker Compose v2 plugin — skip if already present
if docker compose version &> /dev/null; then
  echo "Docker Compose plugin already installed, skipping."
else
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

systemctl start docker || true

# ---------------------------------------------------------------------------
# 2. Postgres via docker compose (Postgres only — app containers are
#    deployed separately by CI/CD).
# ---------------------------------------------------------------------------
cat > "$APP_DIR/docker-compose.postgres.yml" <<'EOF'
services:
  postgres:
    image: postgres:16-alpine
    container_name: opendispatch-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${db_name}
      POSTGRES_USER: ${db_username}
      POSTGRES_PASSWORD: ${db_password}
    ports:
      - "${db_port}:5432"
    volumes:
      - opendispatch_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${db_username}"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  opendispatch_postgres_data:
EOF

cd "$APP_DIR"
docker compose -f docker-compose.postgres.yml up -d

# ---------------------------------------------------------------------------
# 3. nginx reverse proxy — /web/* -> :${web_port}, /api/* -> :${api_port}
#    (skip install if already present)
# ---------------------------------------------------------------------------
if command -v nginx &> /dev/null; then
  echo "nginx already installed, skipping."
else
  dnf install -y nginx
  systemctl enable nginx
fi

cat > /etc/nginx/conf.d/opendispatch.conf <<'EOF'
server {
    listen 80 default_server;
    server_name _;

    location /web/ {
        proxy_pass http://127.0.0.1:${web_port}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${api_port}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Remove default server block if it conflicts on port 80
sed -i 's/listen\s*80.*default_server;/listen 8080 default_server;/' /etc/nginx/nginx.conf 2>/dev/null || true

nginx -t
systemctl restart nginx

echo "Bootstrap complete."
