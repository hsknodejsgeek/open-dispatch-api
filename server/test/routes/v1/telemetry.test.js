'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const Fastify = require('fastify')
const fastifyWebsocket = require('@fastify/websocket')
const WebSocket = require('ws')

const telemetryRoutes = require('../../../routes/v1/telemetry')

async function buildApp (t) {
  const fastify = Fastify()
  fastify.register(fastifyWebsocket)
  fastify.register(telemetryRoutes, { prefix: '/v1/telemetry' })

  await fastify.listen({ port: 0, host: '127.0.0.1' })
  t.after(() => fastify.close())
  return fastify
}

test('GET /v1/telemetry/ws upgrades and streams mock GPS pings', async (t) => {
  const app = await buildApp(t)
  const { port } = app.server.address()

  const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/telemetry/ws`)
  t.after(() => ws.terminate())

  const messages = []
  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })

  await new Promise((resolve, reject) => {
    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()))
      if (messages.length >= 1) resolve()
    })
    setTimeout(() => reject(new Error('timed out waiting for a telemetry ping')), 4000)
  })

  const ping = messages[0]
  assert.equal(typeof ping.driverId, 'string')
  assert.equal(typeof ping.lat, 'number')
  assert.equal(typeof ping.lng, 'number')
  assert.equal(typeof ping.speed, 'number')
  assert.ok(!Number.isNaN(Date.parse(ping.timestamp)))
})
