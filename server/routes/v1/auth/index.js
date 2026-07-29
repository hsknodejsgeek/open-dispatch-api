'use strict'

const {
  loginBodySchema,
  loginResponseSchema,
  refreshBodySchema,
  refreshResponseSchema,
  logoutResponseSchema,
  meResponseSchema
} = require('../../../src/modules/auth/schema')
const { login, refresh, logout, me } = require('../../../src/modules/auth/controller')

module.exports = async function (fastify, opts) {
  fastify.post('/login', {
    schema: {
      body: loginBodySchema,
      response: {
        200: loginResponseSchema
      }
    }
  }, async (request, reply) => login(fastify, request, reply))

  fastify.post('/refresh', {
    schema: {
      body: refreshBodySchema,
      response: {
        200: refreshResponseSchema
      }
    }
  }, async (request, reply) => refresh(fastify, request, reply))

  fastify.post('/logout', {
    schema: {
      response: {
        200: logoutResponseSchema
      }
    }
  }, async (request, reply) => logout(fastify, request, reply))

  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: meResponseSchema
      }
    }
  }, async (request, reply) => me(fastify, request, reply))
}
