'use strict'

const MAX_TRACKING_NUMBER_ATTEMPTS = 5

// Allowed forward transitions. PENDING can move to IN_TRANSIT or be
// CANCELLED; IN_TRANSIT can move to DELIVERED or be CANCELLED; DELIVERED
// and CANCELLED are terminal states with no further transitions.
const VALID_STATUS_TRANSITIONS = {
  PENDING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: []
}

function isValidStatusTransition (from, to) {
  if (from === to) return false
  return (VALID_STATUS_TRANSITIONS[from] || []).includes(to)
}

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
 * GET /v1/deliveries — paginated list, optionally filtered by status
 * and/or driverId (the mobile driver app uses driverId to fetch only its
 * own assigned jobs). Sets an `X-Total-Count` response header with the
 * total (unfiltered by pagination) matching row count.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function listDeliveries (fastify, request, reply) {
  const { status, driverId, page = 1, limit = 20 } = request.query
  const where = {}
  if (status) where.status = status
  if (driverId) where.driverId = driverId

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
 * GET /v1/deliveries/:id — a single delivery by id. Returns 404 if it
 * doesn't exist.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function getDeliveryById (fastify, request, reply) {
  const { id } = request.params

  const delivery = await fastify.models.Delivery.findByPk(id)
  if (!delivery) {
    return reply.notFound(`Delivery ${id} not found`)
  }

  return serializeDelivery(delivery)
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

/**
 * PATCH /v1/deliveries/:id/status — transitions a delivery to a new status,
 * validating the transition against VALID_STATUS_TRANSITIONS.
 *
 * Returns 404 if the delivery doesn't exist, 409 if the transition isn't
 * allowed from the delivery's current status.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function updateDeliveryStatus (fastify, request, reply) {
  const { id } = request.params
  const { status: nextStatus } = request.body
  const { Delivery } = fastify.models

  const delivery = await Delivery.findByPk(id)
  if (!delivery) {
    return reply.notFound(`Delivery ${id} not found`)
  }

  const currentStatus = delivery.status
  if (!isValidStatusTransition(currentStatus, nextStatus)) {
    return reply.conflict(`Cannot transition delivery from ${currentStatus} to ${nextStatus}`)
  }

  delivery.status = nextStatus
  await delivery.save()

  return serializeDelivery(delivery)
}

module.exports = {
  listDeliveries,
  getDeliveryById,
  createDelivery,
  updateDeliveryStatus,
  generateUniqueTrackingNumber,
  serializeDelivery,
  isValidStatusTransition,
  VALID_STATUS_TRANSITIONS
}
