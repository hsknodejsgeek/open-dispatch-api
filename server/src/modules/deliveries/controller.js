'use strict'

const MAX_TRACKING_NUMBER_ATTEMPTS = 5

function randomTrackingNumber () {
  const digits = Math.floor(1000 + Math.random() * 9000) // 4-digit, 1000-9999
  return `TRK-${digits}`
}

/**
 * Generates a tracking number in the form TRK-#### that doesn't already
 * exist in the deliveries table, retrying a few times on collision before
 * giving up.
 *
 * @param {import('../../sequelize/models/delivery')} Delivery
 * @returns {Promise<string>}
 */
async function generateUniqueTrackingNumber (Delivery) {
  for (let attempt = 0; attempt < MAX_TRACKING_NUMBER_ATTEMPTS; attempt++) {
    const candidate = randomTrackingNumber()
    const existing = await Delivery.findOne({ where: { trackingNumber: candidate } })
    if (!existing) {
      return candidate
    }
  }
  throw new Error('Unable to generate a unique tracking number, please retry')
}

function serializeDelivery (delivery) {
  const plain = typeof delivery.get === 'function' ? delivery.get({ plain: true }) : delivery
  return {
    id: plain.id,
    trackingNumber: plain.trackingNumber,
    pickupAddress: plain.pickupAddress,
    deliveryAddress: plain.deliveryAddress,
    status: plain.status,
    priority: plain.priority,
    driverId: plain.driverId ?? null,
    createdAt: plain.createdAt instanceof Date ? plain.createdAt.toISOString() : plain.createdAt,
    updatedAt: plain.updatedAt instanceof Date ? plain.updatedAt.toISOString() : plain.updatedAt
  }
}

/**
 * GET /v1/deliveries — paginated list, optionally filtered by status.
 * Sets an `X-Total-Count` response header with the total (unfiltered by
 * pagination) matching row count.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function listDeliveries (fastify, request, reply) {
  const { status, page = 1, limit = 20 } = request.query
  const where = status ? { status } : {}

  const { rows, count } = await fastify.models.Delivery.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']]
  })

  reply.header('X-Total-Count', String(count))

  return {
    items: rows.map(serializeDelivery),
    total: count,
    page,
    limit
  }
}

/**
 * POST /v1/deliveries — creates a delivery with an auto-generated tracking
 * number (TRK-####).
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function createDelivery (fastify, request, reply) {
  const { pickupAddress, deliveryAddress, driverId = null, priority } = request.body
  const { Delivery } = fastify.models

  const trackingNumber = await generateUniqueTrackingNumber(Delivery)

  const delivery = await Delivery.create({
    trackingNumber,
    pickupAddress,
    deliveryAddress,
    driverId,
    ...(priority ? { priority } : {})
  })

  reply.code(201)
  return serializeDelivery(delivery)
}

module.exports = {
  listDeliveries,
  createDelivery,
  generateUniqueTrackingNumber,
  serializeDelivery
}
