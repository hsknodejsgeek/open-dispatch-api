'use strict'

const envSchema = {
  type: 'object',
  required: ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'],
  properties: {
    NODE_ENV: {
      type: 'string',
      default: 'development'
    },
    PORT: {
      type: 'number',
      default: 3000
    },
    DB_HOST: {
      type: 'string',
      default: 'localhost'
    },
    DB_PORT: {
      type: 'number',
      default: 5432
    },
    DB_NAME: {
      type: 'string',
      default: 'opendispatch_db'
    },
    DB_USER: {
      type: 'string',
      default: 'postgres'
    },
    DB_PASSWORD: {
      type: 'string',
      default: 'postgres'
    },
    JWT_SECRET: {
      type: 'string',
      default: 'dev-secret-change-me'
    },
    REFRESH_TOKEN_SECRET: {
      type: 'string',
      default: 'dev-refresh-secret-change-me'
    },
    CORS_ORIGIN: {
      type: 'string',
      default: 'http://localhost:3000'
    }
  }
}

module.exports = { envSchema }
