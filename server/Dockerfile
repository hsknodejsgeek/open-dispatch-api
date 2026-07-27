# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
# Installs all dependencies (including native builds like bcrypt, which needs
# python3/make/g++ to compile against musl on alpine) and validates the app.
FROM node:20-alpine AS build

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ---- Production runner ------------------------------------------------------
# Slim image: only the already-built node_modules and application source,
# running as a non-root user.
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/app.js ./app.js
COPY --from=build /app/plugins ./plugins
COPY --from=build /app/routes ./routes
COPY --from=build /app/src ./src

RUN addgroup -S nodejs && adduser -S fastify -G nodejs
USER fastify

EXPOSE 3000

CMD ["node_modules/.bin/fastify", "start", "-l", "info", "-a", "0.0.0.0", "app.js"]
