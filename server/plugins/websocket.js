'use strict'

const fp = require('fastify-plugin')
const fastifyWebsocket = require('@fastify/websocket')

/**
 * Registers @fastify/websocket so routes can upgrade connections via
 * `{ websocket: true }` in their route options (used by the telemetry
 * module for GET /v1/telemetry/ws).
 */
module.exports = fp(async function (fastify, opts) {
  fastify.register(fastifyWebsocket)
}, {
  name: 'websocket'
})
