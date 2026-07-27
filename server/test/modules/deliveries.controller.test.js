'use strict'

const { test } = require('node:test')
const assert = require('node:assert')

const {
  listDeliveries,
  createDelivery,
  generateUniqueTrackingNumber
} = require('../../src/modules/deliveries/controller')

function buildFakeReply () {
  const headers = {}
  let statusCode = 200
  return {
    header (name, value) { headers[name] = value; return this },
    code (c) { statusCode = c; return this },
    get headers () { return headers },
    get statusCode () { return statusCode }
  }
}

test('listDeliveries paginates, filters by status, and sets X-Total-Count', async () => {
  const rows = [
    { id: '1', trackingNumber: 'TRK-1111', pickupAddress: 'A', deliveryAddress: 'B', status: 'PENDING', priority: 'LOW', driverId: null, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') }
  ]
  let capturedArgs = null
  const fastify = {
    models: {
      Delivery: {
        findAndCountAll: async (args) => {
          capturedArgs = args
          return { rows, count: 42 }
        }
      }
    }
  }
  const reply = buildFakeReply()

  const result = await listDeliveries(fastify, { query: { status: 'PENDING', page: 2, limit: 10 } }, reply)

  assert.deepEqual(capturedArgs.where, { status: 'PENDING' })
  assert.equal(capturedArgs.limit, 10)
  assert.equal(capturedArgs.offset, 10) // (page 2 - 1) * limit 10
  assert.equal(reply.headers['X-Total-Count'], '42')
  assert.equal(result.total, 42)
  assert.equal(result.page, 2)
  assert.equal(result.limit, 10)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].trackingNumber, 'TRK-1111')
  assert.equal(result.items[0].createdAt, '2026-01-01T00:00:00.000Z')
})

test('listDeliveries defaults to page 1, limit 20, no status filter', async () => {
  let capturedArgs = null
  const fastify = {
    models: {
      Delivery: {
        findAndCountAll: async (args) => { capturedArgs = args; return { rows: [], count: 0 } }
      }
    }
  }
  const reply = buildFakeReply()

  await listDeliveries(fastify, { query: {} }, reply)

  assert.deepEqual(capturedArgs.where, {})
  assert.equal(capturedArgs.limit, 20)
  assert.equal(capturedArgs.offset, 0)
})

test('createDelivery generates a TRK-#### tracking number and returns 201', async () => {
  let createdWith = null
  const fastify = {
    models: {
      Delivery: {
        findOne: async () => null, // no collision
        create: async (attrs) => {
          createdWith = attrs
          return {
            get: () => ({
              id: 'new-id',
              ...attrs,
              createdAt: new Date('2026-01-02'),
              updatedAt: new Date('2026-01-02')
            })
          }
        }
      }
    }
  }
  const reply = buildFakeReply()
  const request = { body: { pickupAddress: '123 Main St', deliveryAddress: '456 Oak Ave', priority: 'HIGH' } }

  const result = await createDelivery(fastify, request, reply)

  assert.match(createdWith.trackingNumber, /^TRK-\d{4}$/)
  assert.equal(createdWith.pickupAddress, '123 Main St')
  assert.equal(createdWith.deliveryAddress, '456 Oak Ave')
  assert.equal(createdWith.driverId, null)
  assert.equal(createdWith.priority, 'HIGH')
  assert.equal(reply.statusCode, 201)
  assert.match(result.trackingNumber, /^TRK-\d{4}$/)
  assert.equal(result.pickupAddress, '123 Main St')
})

test('createDelivery omits priority from create() call when not provided (model default applies)', async () => {
  let createdWith = null
  const fastify = {
    models: {
      Delivery: {
        findOne: async () => null,
        create: async (attrs) => {
          createdWith = attrs
          return { get: () => ({ id: 'x', ...attrs, createdAt: new Date(), updatedAt: new Date() }) }
        }
      }
    }
  }
  const reply = buildFakeReply()
  const request = { body: { pickupAddress: 'A', deliveryAddress: 'B' } }

  await createDelivery(fastify, request, reply)

  assert.ok(!('priority' in createdWith))
})

test('generateUniqueTrackingNumber retries on collision and eventually throws if always colliding', async () => {
  const Delivery = { findOne: async () => ({ id: 'collision' }) }
  await assert.rejects(() => generateUniqueTrackingNumber(Delivery), /Unable to generate a unique tracking number/)
})

test('generateUniqueTrackingNumber returns first non-colliding candidate', async () => {
  const Delivery = { findOne: async () => null }
  const trackingNumber = await generateUniqueTrackingNumber(Delivery)
  assert.match(trackingNumber, /^TRK-\d{4}$/)
})
