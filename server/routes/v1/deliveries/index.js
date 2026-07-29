'use strict'

const {
  listDeliveriesQuerySchema,
  listDeliveriesResponseSchema,
  createDeliveryBodySchema,
  deliveryIdParamsSchema,
  updateDeliveryStatusBodySchema,
  deliverySchema
} = require('../../../src/modules/deliveries/schema')
const { listDeliveries, getDeliveryById, createDelivery, updateDeliveryStatus } = require('../../../src/modules/deliveries/controller')

/**
 * HTTP query strings are always strings (`?limit=1` arrives as
 * `request.query.limit === '1'`, never the number `1`). The `typebox`
 * package that `@fastify/type-provider-typebox` v6 compiles schemas with
 * does not coerce querystring values to match `Type.Integer()` the way
 * older typebox/ajv-based setups did — `Value.Convert(Type.Integer(), '1')`
 * returns `'1'` unchanged, so validation then correctly (if unhelpfully)
 * rejects it with "must be integer". This runs before validation to coerce
 * the numeric fields ourselves so any well-formed request (including plain
 * `fetch`/`curl` calls, which have no other way to send these) validates.
 */
function coercePaginationQuery (request, reply, done) {
  if (request.query && typeof request.query === 'object') {
    for (const key of ['page', 'limit']) {
      const value = request.query[key]
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        request.query[key] = Number(value)
      }
    }
  }
  done()
}

module.exports = async function (fastify, opts) {
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    preValidation: [coercePaginationQuery],
    schema: {
      querystring: listDeliveriesQuerySchema,
      response: {
        200: listDeliveriesResponseSchema
      }
    }
  }, async (request, reply) => listDeliveries(fastify, request, reply))

  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: deliveryIdParamsSchema,
      response: {
        200: deliverySchema
      }
    }
  }, async (request, reply) => getDeliveryById(fastify, request, reply))

  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      body: createDeliveryBodySchema,
      response: {
        201: deliverySchema
      }
    }
  }, async (request, reply) => createDelivery(fastify, request, reply))

  fastify.patch('/:id/status', {
    preHandler: [fastify.authenticate],
    schema: {
      params: deliveryIdParamsSchema,
      body: updateDeliveryStatusBodySchema,
      response: {
        200: deliverySchema
      }
    }
  }, async (request, reply) => updateDeliveryStatus(fastify, request, reply))
}
