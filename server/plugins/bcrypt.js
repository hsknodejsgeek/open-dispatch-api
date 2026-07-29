'use strict'

const fp = require('fastify-plugin')
const bcrypt = require('bcrypt')

const SALT_ROUNDS = 10

/**
 * Decorates fastify with password hashing helpers backed by bcrypt.
 * Used by the auth module for login/registration flows.
 */
module.exports = fp(async function (fastify, opts) {
  fastify.decorate('bcrypt', {
    hash: (plain) => bcrypt.hash(plain, SALT_ROUNDS),
    compare: (plain, hash) => bcrypt.compare(plain, hash)
  })
}, {
  name: 'bcrypt'
})
