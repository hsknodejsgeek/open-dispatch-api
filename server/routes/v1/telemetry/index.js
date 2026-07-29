'use strict'

const { handleTelemetryConnection } = require('../../../src/modules/telemetry/controller')

module.exports = async function (fastify, opts) {
  fastify.get('/ws', { websocket: true, preHandler: [fastify.authenticate] }, (socket, request) => {
    handleTelemetryConnection(socket, request)
  })
}
