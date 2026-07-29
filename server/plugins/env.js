'use strict'

const fp = require('fastify-plugin')
const fastifyEnv = require('@fastify/env')
const { envSchema } = require('../src/config/env')

/**
 * Loads and validates process.env, decorating fastify.config.
 */
module.exports = fp(async function (fastify, opts) {
  fastify.register(fastifyEnv, {
    confKey: 'config',
    schema: envSchema,
    dotenv: true
  })
}, {
  name: 'env'
})
