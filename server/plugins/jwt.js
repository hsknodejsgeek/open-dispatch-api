'use strict'

const fp = require('fastify-plugin')
const fastifyCookie = require('@fastify/cookie')
const fastifyJwt = require('@fastify/jwt')

/**
 * Registers @fastify/cookie and @fastify/jwt, configuring JWT to be read
 * from/written to an httpOnly cookie. Adds a fastify.authenticate decorator
 * that route handlers can use as an onRequest preHandler to require auth.
 *
 * Depends on the env plugin (needs fastify.config.JWT_SECRET).
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
