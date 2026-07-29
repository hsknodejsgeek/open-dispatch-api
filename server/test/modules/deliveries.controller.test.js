'use strict'

const { test } = require('node:test')
const assert = require('node:assert')

const {
  listDeliveries,
  createDelivery,
  updateDeliveryStatus,
  generateUniqueTrackingNumber,
  isValidStatusTransition
} = require('../../src/modules/deliveries/controller')

function buildFakeReply () {
  const headers = {}
  let statusCode = 200
  let notFoundCalledWith = null
  let conflictCalledWith = null
  return {
    header (name, value) { headers[name] = value; return this },
    code (c) { statusCode = c; return this },
    notFound (message) { notFoundCalledWith = message; return { statusCode: 404, message } },
    conflict (message) { conflictCalledWith = message; return { statusCode: 409, message } },
    get headers () { return headers },
    get statusCode () { return statusCode },
    get notFoundCalledWith () { return notFoundCalledWith },
    get conflictCalledWith () { return conflictCalledWith }
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

test('isValidStatusTransition allows PENDING -> IN_TRANSIT and PENDING -> CANCELLED', () => {
  assert.equal(isValidStatusTransition('PENDING', 'IN_TRANSIT'), true)
  assert.equal(isValidStatusTransition('PENDING', 'CANCELLED'), true)
})

test('isValidStatusTransition allows IN_TRANSIT -> DELIVERED and IN_TRANSIT -> CANCELLED', () => {
  assert.equal(isValidStatusTransition('IN_TRANSIT', 'DELIVERED'), true)
  assert.equal(isValidStatusTransition('IN_TRANSIT', 'CANCELLED'), true)
})

test('isValidStatusTransition rejects terminal states moving anywhere', () => {
  assert.equal(isValidStatusTransition('DELIVERED', 'PENDING'), false)
  assert.equal(isValidStatusTransition('DELIVERED', 'IN_TRANSIT'), false)
  assert.equal(isValidStatusTransition('CANCELLED', 'PENDING'), false)
})

test('isValidStatusTransition rejects skipping ahead (PENDING -> DELIVERED) and same-state no-ops', () => {
  assert.equal(isValidStatusTransition('PENDING', 'DELIVERED'), false)
  assert.equal(isValidStatusTransition('PENDING', 'PENDING'), false)
})

function buildFakeDeliveryInstance (attrs) {
  const record = { ...attrs }
  return {
    get status () { return record.status },
    set status (v) { record.status = v },
    get id () { return record.id },
    get () { return { ...record } },
    save: async () => { record.updatedAt = new Date('2026-02-01') }
  }
}

test('updateDeliveryStatus transitions a valid change and persists it', async () => {
  const instance = buildFakeDeliveryInstance({
    id: 'd-1',
    trackingNumber: 'TRK-1111',
    pickupAddress: 'A',
    deliveryAddress: 'B',
    status: 'PENDING',
    priority: 'LOW',
    driverId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
  })
  const fastify = { models: { Delivery: { findByPk: async () => instance } } }
  const reply = buildFakeReply()
  const request = { params: { id: 'd-1' }, body: { status: 'IN_TRANSIT' } }

  const result = await updateDeliveryStatus(fastify, request, reply)

  assert.equal(result.status, 'IN_TRANSIT')
  assert.equal(instance.status, 'IN_TRANSIT')
})

test('updateDeliveryStatus returns 404 when the delivery does not exist', async () => {
  const fastify = { models: { Delivery: { findByPk: async () => null } } }
  const reply = buildFakeReply()
  const request = { params: { id: 'missing' }, body: { status: 'IN_TRANSIT' } }

  const result = await updateDeliveryStatus(fastify, request, reply)

  assert.equal(result.statusCode, 404)
  assert.match(reply.notFoundCalledWith, /missing/)
})

test('updateDeliveryStatus returns 409 for an invalid transition', async () => {
  const instance = buildFakeDeliveryInstance({
    id: 'd-2',
    trackingNumber: 'TRK-2222',
    pickupAddress: 'A',
    deliveryAddress: 'B',
    status: 'DELIVERED',
    priority: 'LOW',
    driverId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  })
  const fastify = { models: { Delivery: { findByPk: async () => instance } } }
  const reply = buildFakeReply()
  const request = { params: { id: 'd-2' }, body: { status: 'PENDING' } }

  const result = await updateDeliveryStatus(fastify, request, reply)

  assert.equal(result.statusCode, 409)
  assert.match(reply.conflictCalledWith, /Cannot transition delivery from DELIVERED to PENDING/)
  assert.equal(instance.status, 'DELIVERED') // unchanged
})
