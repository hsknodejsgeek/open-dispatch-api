'use strict'

const {
  listDeliveriesQuerySchema,
  listDeliveriesResponseSchema,
  createDeliveryBodySchema,
  deliveryIdParamsSchema,
  updateDeliveryStatusBodySchema,
  deliverySchema
} = require('../../../src/modules/deliveries/schema')
const { listDeliveries, createDelivery, updateDeliveryStatus } = require('../../../src/modules/deliveries/controller')

module.exports = async function (fastify, opts) {
  fastify.get('/', {
    schema: {
      querystring: listDeliveriesQuerySchema,
      response: {
        200: listDeliveriesResponseSchema
      }
    }
  }, async (request, reply) => listDeliveries(fastify, request, reply))

  fastify.post('/', {
    schema: {
      body: createDeliveryBodySchema,
      response: {
        201: deliverySchema
      }
    }
  }, async (request, reply) => createDelivery(fastify, request, reply))

  fastify.patch('/:id/status', {
    schema: {
      params: deliveryIdParamsSchema,
      body: updateDeliveryStatusBodySchema,
      response: {
        200: deliverySchema
      }
    }
  }, async (request, reply) => updateDeliveryStatus(fastify, request, reply))
}
