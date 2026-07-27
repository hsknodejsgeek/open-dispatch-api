'use strict'

const { loginBodySchema, loginResponseSchema } = require('../../../src/modules/auth/schema')
const { login } = require('../../../src/modules/auth/controller')

module.exports = async function (fastify, opts) {
  fastify.post('/login', {
    schema: {
      body: loginBodySchema,
      response: {
        200: loginResponseSchema
      }
    }
  }, async (request, reply) => login(fastify, request, reply))
}
