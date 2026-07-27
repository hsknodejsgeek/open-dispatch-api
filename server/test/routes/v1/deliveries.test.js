'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const Fastify = require('fastify')
const sensible = require('@fastify/sensible')

const deliveriesRoutes = require('../../../routes/v1/deliveries')

function buildDeliveryRecord (overrides = {}) {
  const base = {
    id: 'd-1',
    trackingNumber: 'TRK-1234',
    pickupAddress: '123 Main St',
    deliveryAddress: '456 Oak Ave',
    status: 'PENDING',
    priority: 'MEDIUM',
    driverId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides
  }
  return { get: () => base }
}

function buildStatefulDeliveryInstance (overrides = {}) {
  const record = {
    id: 'd-1',
    trackingNumber: 'TRK-1234',
    pickupAddress: '123 Main St',
    deliveryAddress: '456 Oak Ave',
    status: 'PENDING',
    priority: 'MEDIUM',
    driverId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides
  }
  return {
    get status () { return record.status },
    set status (v) { record.status = v },
    get () { return { ...record } },
    save: async () => { record.updatedAt = new Date('2026-02-01') }
  }
}

async function buildApp (t, { rows = [], count = 0, findOneResult = null, onCreate, findByPkResult } = {}) {
  const fastify = Fastify()

  fastify.register(sensible, { errorHandler: false })

  fastify.decorate('models', {
    Delivery: {
      findAndCountAll: async () => ({ rows, count }),
      findOne: async () => findOneResult,
      findByPk: async () => (findByPkResult === undefined ? null : findByPkResult),
      create: async (attrs) => {
        if (onCreate) onCreate(attrs)
        return buildDeliveryRecord(attrs)
      }
    }
  })

  fastify.register(deliveriesRoutes, { prefix: '/v1/deliveries' })

  t.after(() => fastify.close())
  await fastify.ready()
  return fastify
}

test('GET /v1/deliveries returns items, total, and X-Total-Count header', async (t) => {
  const rows = [buildDeliveryRecord()]
  const app = await buildApp(t, { rows, count: 1 })

  const res = await app.inject({ method: 'GET', url: '/v1/deliveries' })

  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['x-total-count'], '1')
  const body = res.json()
  assert.equal(body.total, 1)
  assert.equal(body.page, 1)
  assert.equal(body.limit, 20)
  assert.equal(body.items.length, 1)
  assert.equal(body.items[0].trackingNumber, 'TRK-1234')
})

test('GET /v1/deliveries accepts status filter, page, and limit query params', async (t) => {
  const app = await buildApp(t, { rows: [], count: 0 })

  const res = await app.inject({ method: 'GET', url: '/v1/deliveries?status=DELIVERED&page=3&limit=5' })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.page, 3)
  assert.equal(body.limit, 5)
})

test('GET /v1/deliveries returns 400 for invalid status enum value', async (t) => {
  const app = await buildApp(t, {})

  const res = await app.inject({ method: 'GET', url: '/v1/deliveries?status=NOT_A_STATUS' })

  assert.equal(res.statusCode, 400)
})

test('POST /v1/deliveries creates a delivery with generated tracking number, returns 201', async (t) => {
  let created = null
  const app = await buildApp(t, { findOneResult: null, onCreate: (attrs) => { created = attrs } })

  const res = await app.inject({
    method: 'POST',
    url: '/v1/deliveries',
    payload: { pickupAddress: '1 A St', deliveryAddress: '2 B Ave', priority: 'HIGH' }
  })

  assert.equal(res.statusCode, 201)
  const body = res.json()
  assert.match(body.trackingNumber, /^TRK-\d{4}$/)
  assert.equal(created.pickupAddress, '1 A St')
  assert.equal(created.priority, 'HIGH')
})

test('POST /v1/deliveries returns 400 when pickupAddress is missing', async (t) => {
  const app = await buildApp(t, {})

  const res = await app.inject({
    method: 'POST',
    url: '/v1/deliveries',
    payload: { deliveryAddress: '2 B Ave' }
  })

  assert.equal(res.statusCode, 400)
})

test('POST /v1/deliveries returns 400 for invalid priority enum', async (t) => {
  const app = await buildApp(t, {})

  const res = await app.inject({
    method: 'POST',
    url: '/v1/deliveries',
    payload: { pickupAddress: 'A', deliveryAddress: 'B', priority: 'URGENT' }
  })

  assert.equal(res.statusCode, 400)
})

test('PATCH /v1/deliveries/:id/status applies a valid transition', async (t) => {
  const instance = buildStatefulDeliveryInstance({ status: 'PENDING' })
  const app = await buildApp(t, { findByPkResult: instance })

  const res = await app.inject({
    method: 'PATCH',
    url: '/v1/deliveries/d-1/status',
    payload: { status: 'IN_TRANSIT' }
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.equal(body.status, 'IN_TRANSIT')
})

test('PATCH /v1/deliveries/:id/status returns 404 when delivery does not exist', async (t) => {
  const app = await buildApp(t, { findByPkResult: null })

  const res = await app.inject({
    method: 'PATCH',
    url: '/v1/deliveries/missing/status',
    payload: { status: 'IN_TRANSIT' }
  })

  assert.equal(res.statusCode, 404)
})

test('PATCH /v1/deliveries/:id/status returns 409 for an invalid transition', async (t) => {
  const instance = buildStatefulDeliveryInstance({ status: 'DELIVERED' })
  const app = await buildApp(t, { findByPkResult: instance })

  const res = await app.inject({
    method: 'PATCH',
    url: '/v1/deliveries/d-1/status',
    payload: { status: 'PENDING' }
  })

  assert.equal(res.statusCode, 409)
})

test('PATCH /v1/deliveries/:id/status returns 400 for invalid status enum value', async (t) => {
  const instance = buildStatefulDeliveryInstance({ status: 'PENDING' })
  const app = await buildApp(t, { findByPkResult: instance })

  const res = await app.inject({
    method: 'PATCH',
    url: '/v1/deliveries/d-1/status',
    payload: { status: 'NOT_A_STATUS' }
  })

  assert.equal(res.statusCode, 400)
})
