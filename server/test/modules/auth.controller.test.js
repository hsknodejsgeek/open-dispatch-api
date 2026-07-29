'use strict'

const { test } = require('node:test')
const assert = require('node:assert')

const { login, refresh, logout } = require('../../src/modules/auth/controller')

function buildFakeFastify ({ user, passwordMatches, findByPkResult } = {}) {
  const cookies = []
  return {
    config: { NODE_ENV: 'test' },
    models: {
      User: {
        findOne: async () => user,
        findByPk: async () => (findByPkResult !== undefined ? findByPkResult : user)
      }
    },
    bcrypt: {
      compare: async () => passwordMatches
    },
    jwt: {
      sign: (payload) => `access.${payload.userId}.${payload.role}`,
      refresh: {
        sign: (payload) => `refresh.${payload.userId}.${payload.type}`,
        verify: (token) => {
          const [prefix, userId, type] = token.split('.')
          if (prefix !== 'refresh') throw new Error('invalid token')
          return { userId, type }
        }
      }
    },
    _cookies: cookies
  }
}

function buildFakeReply (fastify) {
  let unauthorizedCalled = null
  const clearedCookies = []
  return {
    setCookie (name, value, opts) {
      fastify._cookies.push({ name, value, opts })
      return this
    },
    clearCookie (name, opts) {
      clearedCookies.push({ name, opts })
      return this
    },
    unauthorized (message) {
      unauthorizedCalled = message
      return { statusCode: 401, message }
    },
    get unauthorizedCalledWith () {
      return unauthorizedCalled
    },
    get clearedCookies () {
      return clearedCookies
    }
  }
}

test('login (web) returns only user in body, sets httpOnly access + refresh cookies', async () => {
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER', passwordHash: 'hashed' }
  const fastify = buildFakeFastify({ user, passwordMatches: true })
  const reply = buildFakeReply(fastify)
  const request = { headers: {}, body: { email: user.email, password: 'correct-password' } }

  const result = await login(fastify, request, reply)

  assert.equal(result.accessToken, undefined)
  assert.equal(result.refreshToken, undefined)
  assert.deepEqual(result.user, { id: 'user-1', email: user.email, role: 'DISPATCHER' })

  assert.equal(fastify._cookies.length, 2)
  const accessCookie = fastify._cookies.find((c) => c.name === 'token')
  const refreshCookie = fastify._cookies.find((c) => c.name === 'refreshToken')
  assert.equal(accessCookie.value, 'access.user-1.DISPATCHER')
  assert.equal(accessCookie.opts.httpOnly, true)
  assert.equal(accessCookie.opts.secure, false)
  assert.equal(refreshCookie.value, 'refresh.user-1.refresh')
  assert.equal(refreshCookie.opts.httpOnly, true)
  assert.equal(refreshCookie.opts.path, '/v1/auth')
})

test('login (mobile) returns tokens in body and sets no cookies', async () => {
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER', passwordHash: 'hashed' }
  const fastify = buildFakeFastify({ user, passwordMatches: true })
  const reply = buildFakeReply(fastify)
  const request = {
    headers: { 'x-client-type': 'mobile' },
    body: { email: user.email, password: 'correct-password' }
  }

  const result = await login(fastify, request, reply)

  assert.equal(result.accessToken, 'access.user-1.DISPATCHER')
  assert.equal(result.refreshToken, 'refresh.user-1.refresh')
  assert.deepEqual(result.user, { id: 'user-1', email: user.email, role: 'DISPATCHER' })
  assert.equal(fastify._cookies.length, 0)
})

test('login rejects unknown email with 401 and no cookies', async () => {
  const fastify = buildFakeFastify({ user: null, passwordMatches: false })
  const reply = buildFakeReply(fastify)
  const request = { headers: {}, body: { email: 'nobody@example.com', password: 'whatever' } }

  const result = await login(fastify, request, reply)

  assert.equal(result.statusCode, 401)
  assert.equal(reply.unauthorizedCalledWith, 'Invalid email or password')
  assert.equal(fastify._cookies.length, 0)
})

test('login rejects wrong password with 401 and no cookies', async () => {
  const user = { id: 'user-2', email: 'driver@example.com', role: 'DRIVER', passwordHash: 'hashed' }
  const fastify = buildFakeFastify({ user, passwordMatches: false })
  const reply = buildFakeReply(fastify)
  const request = { headers: {}, body: { email: user.email, password: 'wrong-password' } }

  const result = await login(fastify, request, reply)

  assert.equal(result.statusCode, 401)
  assert.equal(reply.unauthorizedCalledWith, 'Invalid email or password')
  assert.equal(fastify._cookies.length, 0)
})

test('refresh (web) reads cookie, rotates tokens, sets new cookies', async () => {
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER' }
  const fastify = buildFakeFastify({ user, findByPkResult: user })
  const reply = buildFakeReply(fastify)
  const request = { headers: {}, cookies: { refreshToken: 'refresh.user-1.refresh' } }

  const result = await refresh(fastify, request, reply)

  assert.equal(result.accessToken, undefined)
  assert.deepEqual(result.user, { id: 'user-1', email: user.email, role: 'DISPATCHER' })
  assert.equal(fastify._cookies.length, 2)
})

test('refresh (mobile) reads body token, returns rotated tokens', async () => {
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER' }
  const fastify = buildFakeFastify({ user, findByPkResult: user })
  const reply = buildFakeReply(fastify)
  const request = {
    headers: { 'x-client-type': 'mobile' },
    body: { refreshToken: 'refresh.user-1.refresh' }
  }

  const result = await refresh(fastify, request, reply)

  assert.equal(result.accessToken, 'access.user-1.DISPATCHER')
  assert.ok(result.refreshToken.startsWith('refresh.user-1'))
  assert.equal(fastify._cookies.length, 0)
})

test('refresh rejects missing token with 401', async () => {
  const fastify = buildFakeFastify({})
  const reply = buildFakeReply(fastify)
  const request = { headers: {}, cookies: {} }

  const result = await refresh(fastify, request, reply)

  assert.equal(result.statusCode, 401)
})

test('refresh rejects an invalid token with 401', async () => {
  const fastify = buildFakeFastify({})
  const reply = buildFakeReply(fastify)
  const request = { headers: {}, cookies: { refreshToken: 'garbage' } }

  const result = await refresh(fastify, request, reply)

  assert.equal(result.statusCode, 401)
})

test('refresh rejects when the user no longer exists', async () => {
  const fastify = buildFakeFastify({ findByPkResult: null })
  const reply = buildFakeReply(fastify)
  const request = { headers: {}, cookies: { refreshToken: 'refresh.user-1.refresh' } }

  const result = await refresh(fastify, request, reply)

  assert.equal(result.statusCode, 401)
})

test('logout clears both auth cookies', async () => {
  const fastify = buildFakeFastify({})
  const reply = buildFakeReply(fastify)

  const result = await logout(fastify, {}, reply)

  assert.deepEqual(result, { success: true })
  assert.equal(reply.clearedCookies.length, 2)
  assert.ok(reply.clearedCookies.some((c) => c.name === 'token'))
  assert.ok(reply.clearedCookies.some((c) => c.name === 'refreshToken'))
})
