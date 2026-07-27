'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const Fastify = require('fastify')
const fastifyCookie = require('@fastify/cookie')
const sensible = require('@fastify/sensible')
const bcrypt = require('bcrypt')

const authRoutes = require('../../../routes/v1/auth')

async function buildApp (t, { user } = {}) {
  const fastify = Fastify()

  fastify.register(sensible, { errorHandler: false })
  fastify.register(fastifyCookie)

  fastify.decorate('config', { NODE_ENV: 'test' })
  fastify.decorate('models', {
    User: {
      findOne: async ({ where }) => (user && where.email === user.email ? user : null)
    }
  })
  fastify.decorate('bcrypt', {
    compare: (plain, hash) => bcrypt.compare(plain, hash)
  })
  fastify.decorate('jwt', {
    sign: (payload) => `signed.${payload.userId}.${payload.role}`
  })

  fastify.register(authRoutes, { prefix: '/v1/auth' })

  t.after(() => fastify.close())
  await fastify.ready()
  return fastify
}

test('POST /v1/auth/login succeeds with valid credentials and sets httpOnly cookie', async (t) => {
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
  assert.equal(body.accessToken, 'signed.user-1.DISPATCHER')
  assert.deepEqual(body.user, { id: 'user-1', email: user.email, role: 'DISPATCHER' })

  const setCookie = res.headers['set-cookie']
  assert.ok(setCookie, 'expected a set-cookie header')
  assert.match(setCookie, /token=/)
  assert.match(setCookie, /HttpOnly/i)
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
