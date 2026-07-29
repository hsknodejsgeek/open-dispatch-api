'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const Fastify = require('fastify')
const fastifyCookie = require('@fastify/cookie')
const sensible = require('@fastify/sensible')
const bcrypt = require('bcrypt')

const authRoutes = require('../../../routes/v1/auth')

function fakeJwt (findByPkResult) {
  return {
    sign: (payload) => `access.${payload.userId}.${payload.role}`,
    refresh: {
      sign: (payload) => `refresh.${payload.userId}.${payload.type}`,
      verify: (token) => {
        const [prefix, userId, type] = String(token).split('.')
        if (prefix !== 'refresh') throw new Error('invalid token')
        return { userId, type }
      }
    }
  }
}

async function buildApp (t, { user, findByPkResult, authenticateAs } = {}) {
  const fastify = Fastify()

  fastify.register(sensible, { errorHandler: false })
  fastify.register(fastifyCookie)

  fastify.decorate('config', { NODE_ENV: 'test' })
  fastify.decorate('models', {
    User: {
      findOne: async ({ where }) => (user && where.email === user.email ? user : null),
      findByPk: async () => (findByPkResult !== undefined ? findByPkResult : user)
    }
  })
  fastify.decorate('bcrypt', {
    compare: (plain, hash) => bcrypt.compare(plain, hash)
  })
  fastify.decorate('jwt', fakeJwt())
  // Only exercised by preHandler: [fastify.authenticate] routes (GET /me);
  // login/refresh/logout don't use it. Tests opt in via `authenticateAs`.
  fastify.decorate('authenticate', async (request) => {
    request.user = authenticateAs || {}
  })

  fastify.register(authRoutes, { prefix: '/v1/auth' })

  t.after(() => fastify.close())
  await fastify.ready()
  return fastify
}

function buildUserRecord ({ id, email, role, driver = null }) {
  return {
    get: () => ({ id, email, role, driver })
  }
}

test('POST /v1/auth/login (web) succeeds and sets httpOnly access + refresh cookies, no tokens in body', async (t) => {
  const passwordHash = await bcrypt.hash('correct-password', 10)
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER', passwordHash }
  const app = await buildApp(t, { user })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: user.email, password: 'correct-password' }
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.accessToken, undefined)
  assert.deepEqual(body.user, { id: 'user-1', email: user.email, role: 'DISPATCHER' })

  const setCookie = res.headers['set-cookie']
  assert.ok(setCookie, 'expected set-cookie headers')
  const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : setCookie
  assert.match(cookieStr, /token=/)
  assert.match(cookieStr, /refreshToken=/)
  assert.match(cookieStr, /HttpOnly/i)
})

test('POST /v1/auth/login (mobile) returns tokens in body and sets no cookies', async (t) => {
  const passwordHash = await bcrypt.hash('correct-password', 10)
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER', passwordHash }
  const app = await buildApp(t, { user })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    headers: { 'x-client-type': 'mobile' },
    payload: { email: user.email, password: 'correct-password' }
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.accessToken, 'access.user-1.DISPATCHER')
  assert.ok(body.refreshToken)
  assert.equal(res.headers['set-cookie'], undefined)
})

test('POST /v1/auth/login returns 401 for invalid credentials', async (t) => {
  const passwordHash = await bcrypt.hash('correct-password', 10)
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER', passwordHash }
  const app = await buildApp(t, { user })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: user.email, password: 'wrong-password' }
  })

  assert.equal(res.statusCode, 401)
  assert.equal(res.headers['set-cookie'], undefined)
})

test('POST /v1/auth/login returns 400 for invalid body (bad email format)', async (t) => {
  const app = await buildApp(t, {})

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'not-an-email', password: 'whatever' }
  })

  assert.equal(res.statusCode, 400)
})

test('POST /v1/auth/login returns 400 when password missing', async (t) => {
  const app = await buildApp(t, {})

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'someone@example.com' }
  })

  assert.equal(res.statusCode, 400)
})

test('POST /v1/auth/refresh (web) exchanges cookie for a new session', async (t) => {
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER' }
  const app = await buildApp(t, { user, findByPkResult: user })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: {},
    cookies: { refreshToken: 'refresh.user-1.refresh' }
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.accessToken, undefined)
  assert.deepEqual(body.user, { id: 'user-1', email: user.email, role: 'DISPATCHER' })
  const cookieStr = [].concat(res.headers['set-cookie'] || []).join(';')
  assert.match(cookieStr, /token=/)
  assert.match(cookieStr, /refreshToken=/)
})

test('POST /v1/auth/refresh (mobile) exchanges body token for new tokens', async (t) => {
  const user = { id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER' }
  const app = await buildApp(t, { user, findByPkResult: user })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    headers: { 'x-client-type': 'mobile' },
    payload: { refreshToken: 'refresh.user-1.refresh' }
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.ok(body.accessToken)
  assert.ok(body.refreshToken)
})

test('POST /v1/auth/refresh returns 401 with no token present', async (t) => {
  const app = await buildApp(t, {})

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: {}
  })

  assert.equal(res.statusCode, 401)
})

test('POST /v1/auth/logout clears auth cookies', async (t) => {
  const app = await buildApp(t, {})

  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/logout'
  })

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { success: true })
  const cookieStr = [].concat(res.headers['set-cookie'] || []).join(';')
  assert.match(cookieStr, /token=;/)
  assert.match(cookieStr, /refreshToken=;/)
})

test('GET /v1/auth/me returns the authenticated user with a null driver for dispatchers', async (t) => {
  const record = buildUserRecord({ id: 'user-1', email: 'dispatcher@example.com', role: 'DISPATCHER' })
  const app = await buildApp(t, { findByPkResult: record, authenticateAs: { userId: 'user-1', role: 'DISPATCHER' } })

  const res = await app.inject({ method: 'GET', url: '/v1/auth/me' })

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), {
    id: 'user-1',
    email: 'dispatcher@example.com',
    role: 'DISPATCHER',
    driver: null
  })
})

test('GET /v1/auth/me includes the driver profile for a driver account', async (t) => {
  const driver = { id: 'driver-1', vehicleNo: 'VAN-42', status: 'ON_TRIP', currentLat: 37.77, currentLng: -122.41 }
  const record = buildUserRecord({ id: 'user-2', email: 'driver@example.com', role: 'DRIVER', driver })
  const app = await buildApp(t, { findByPkResult: record, authenticateAs: { userId: 'user-2', role: 'DRIVER' } })

  const res = await app.inject({ method: 'GET', url: '/v1/auth/me' })

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), {
    id: 'user-2',
    email: 'driver@example.com',
    role: 'DRIVER',
    driver: { id: 'driver-1', vehicleNo: 'VAN-42', status: 'ON_TRIP', currentLat: 37.77, currentLng: -122.41 }
  })
})

test('GET /v1/auth/me returns 401 when the user no longer exists', async (t) => {
  const app = await buildApp(t, { findByPkResult: null, authenticateAs: { userId: 'ghost', role: 'DRIVER' } })

  const res = await app.inject({ method: 'GET', url: '/v1/auth/me' })

  assert.equal(res.statusCode, 401)
})
