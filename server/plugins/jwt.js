'use strict'

const fp = require('fastify-plugin')
const fastifyCookie = require('@fastify/cookie')
const fastifyJwt = require('@fastify/jwt')

/**
 * Registers @fastify/cookie and two @fastify/jwt instances:
 *
 *  - the default (unnamespaced) instance signs/verifies short-lived access
 *    tokens, readable from the `Authorization: Bearer` header or the
 *    httpOnly `token` cookie (`fastify.jwt.sign/verify`, `request.jwtVerify()`).
 *  - a `refresh` namespaced instance signs/verifies long-lived refresh
 *    tokens with a separate secret, readable from the httpOnly
 *    `refreshToken` cookie (`fastify.jwt.refresh.sign/verify`,
 *    `request.refreshJwtVerify()`). Keeping the secrets distinct means a
 *    leaked access-token secret can't be used to mint refresh tokens.
 *
 * Adds a fastify.authenticate decorator that route handlers can use as an
 * onRequest preHandler to require a valid access token.
 *
 * Depends on the env plugin (needs fastify.config.JWT_SECRET / REFRESH_TOKEN_SECRET).
 */
module.exports = fp(async function (fastify, opts) {
  fastify.register(fastifyCookie)

  fastify.register(fastifyJwt, {
    secret: fastify.config.JWT_SECRET,
    cookie: {
      cookieName: 'token',
      signed: false
    }
  })

  fastify.register(fastifyJwt, {
    secret: fastify.config.REFRESH_TOKEN_SECRET,
    namespace: 'refresh',
    cookie: {
      cookieName: 'refreshToken',
      signed: false
    }
  })

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })
}, {
  name: 'jwt',
  dependencies: ['env']
})
