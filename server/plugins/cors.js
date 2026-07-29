'use strict'

const fp = require('fastify-plugin')
const fastifyCors = require('@fastify/cors')

/**
 * Registers @fastify/cors with credentials enabled so browsers can send/receive
 * the httpOnly auth cookie on cross-origin requests. `origin` must be an
 * explicit allowlist (not '*') for credentialed requests to work.
 *
 * CORS_ORIGIN in .env may be a single origin or a comma-separated list, e.g.
 *   CORS_ORIGIN=http://localhost:3000,http://localhost:5173
 *
 * Depends on the env plugin (needs fastify.config.CORS_ORIGIN).
 */
module.exports = fp(async function (fastify, opts) {
  const allowedOrigins = fastify.config.CORS_ORIGIN.split(',').map((origin) => origin.trim())

  fastify.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: true
  })
}, {
  name: 'cors',
  dependencies: ['env']
})
