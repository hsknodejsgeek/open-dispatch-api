'use strict'

const { Type } = require('@sinclair/typebox')

const STATUS_VALUES = ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']
const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH']

const deliverySchema = Type.Object({
  id: Type.String(),
  trackingNumber: Type.String(),
  pickupAddress: Type.String(),
  deliveryAddress: Type.String(),
  status: Type.Enum(Object.fromEntries(STATUS_VALUES.map((v) => [v, v]))),
  priority: Type.Enum(Object.fromEntries(PRIORITY_VALUES.map((v) => [v, v]))),
  driverId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String()
})

const listDeliveriesQuerySchema = Type.Object({
  status: Type.Optional(Type.Enum(Object.fromEntries(STATUS_VALUES.map((v) => [v, v])))),
  // Lets the mobile driver app fetch only its own assigned jobs
  // (GET /v1/deliveries?driverId=...).
  driverId: Type.Optional(Type.String()),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 }))
})

const listDeliveriesResponseSchema = Type.Object({
  items: Type.Array(deliverySchema),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer()
})

const createDeliveryBodySchema = Type.Object({
  pickupAddress: Type.String({ minLength: 1 }),
  deliveryAddress: Type.String({ minLength: 1 }),
  driverId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  priority: Type.Optional(Type.Enum(Object.fromEntries(PRIORITY_VALUES.map((v) => [v, v]))))
})

const deliveryIdParamsSchema = Type.Object({
  id: Type.String()
})

const updateDeliveryStatusBodySchema = Type.Object({
  status: Type.Enum(Object.fromEntries(STATUS_VALUES.map((v) => [v, v])))
})

module.exports = {
  STATUS_VALUES,
  PRIORITY_VALUES,
  deliverySchema,
  listDeliveriesQuerySchema,
  listDeliveriesResponseSchema,
  createDeliveryBodySchema,
  deliveryIdParamsSchema,
  updateDeliveryStatusBodySchema
}
