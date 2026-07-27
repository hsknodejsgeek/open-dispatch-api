'use strict'

const { test } = require('node:test')
const assert = require('node:assert')

const { login } = require('../../src/modules/auth/controller')

function buildFakeFastify ({ user, passwordMatches }) {
  const cookies = []
  return {
    config: { NODE_ENV: 'test' },
    models: {
      User: {
        findOne: async () => user
      }
    },
    bcrypt: {
      compare: async () => passwordMatches
    },
    jwt: {
      sign: (payload) => `signed.${payload.userId}.${payload.role}`
    },
    _cookies: cookies
  }
}

function buildFakeReply (fastify) {
  let unauthorizedCalled = null
  return {
    setCookie (name, value, opts) {
      fastify._cookies.push({ name, value, opts })
      return this
    },
    unauthorized (message) {
      unauthorizedCalled = message
      return { statusCode: 401, message }
    },
    get unauthorizedCalledWith () {
      return unauthorizedCalled
    }
  }
}

test('login returns access token + user, sets httpOnly cookie on valid credentials', async () => {
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER', passwordHash: 'hashed' }
  const fastify = buildFakeFastify({ user, passwordMatches: true })
  const reply = buildFakeReply(fastify)
  const request = { body: { email: user.email, password: 'correct-password' } }

  const result = await login(fastify, request, reply)

  assert.equal(result.accessToken, 'signed.user-1.DISPATCHER')
  assert.deepEqual(result.user, { id: 'user-1', email: user.email, role: 'DISPATCHER' })

  assert.equal(fastify._cookies.length, 1)
  const cookie = fastify._cookies[0]
  assert.equal(cookie.name, 'token')
  assert.equal(cookie.value, 'signed.user-1.DISPATCHER')
  assert.equal(cookie.opts.httpOnly, true)
  assert.equal(cookie.opts.secure, false)
})

test('login rejects unknown email with 401 and no cookie', async () => {
  const fastify = buildFakeFastify({ user: null, passwordMatches: false })
  const reply = buildFakeReply(fastify)
  const request = { body: { email: 'nobody@example.com', password: 'whatever' } }

  const result = await login(fastify, request, reply)

  assert.equal(result.statusCode, 401)
  assert.equal(reply.unauthorizedCalledWith, 'Invalid email or password')
  assert.equal(fastify._cookies.length, 0)
})

test('login rejects wrong password with 401 and no cookie', async () => {
  const user = { id: 'user-2', email: 'driver@example.com', role: 'DRIVER', passwordHash: 'hashed' }
  const fastify = buildFakeFastify({ user, passwordMatches: false })
  const reply = buildFakeReply(fastify)
  const request = { body: { email: user.email, password: 'wrong-password' } }

  const result = await login(fastify, request, reply)

  assert.equal(result.statusCode, 401)
  assert.equal(reply.unauthorizedCalledWith, 'Invalid email or password')
  assert.equal(fastify._cookies.length, 0)
})
