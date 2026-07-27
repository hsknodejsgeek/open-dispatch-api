'use strict'

const {
  listDeliveriesQuerySchema,
  listDeliveriesResponseSchema,
  createDeliveryBodySchema,
  deliverySchema
} = require('../../../src/modules/deliveries/schema')
const { listDeliveries, createDelivery } = require('../../../src/modules/deliveries/controller')

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
}
