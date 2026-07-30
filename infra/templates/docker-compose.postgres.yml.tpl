# Postgres-only compose file. Deployed to the instance by the bootstrap
# script; re-run `docker compose -f docker-compose.postgres.yml up -d`
# any time (idempotent — no-op if already running with the same config).
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
