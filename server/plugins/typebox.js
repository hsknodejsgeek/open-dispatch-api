'use strict'

const fp = require('fastify-plugin')
const { TypeBoxValidatorCompiler } = require('@fastify/type-provider-typebox')

/**
 * Wires up the TypeBox validator compiler so route schemas built with
 * @sinclair/typebox (Type.Object(...), etc.) are validated by Ajv via
 * TypeBox's compiler instead of Fastify's default JSON-schema handling.
 *
 * Route files just build schemas with `const { Type } = require('@sinclair/typebox')`
 * and pass them as the route's `schema` option — no further wiring needed.
 */
module.exports = fp(async function (fastify, opts) {
  fastify.setValidatorCompiler(TypeBoxValidatorCompiler)
}, {
  name: 'typebox'
})
