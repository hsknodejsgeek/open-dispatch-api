'use strict'

const { test } = require('node:test')
const assert = require('node:assert')

const { buildMockGpsPing, handleTelemetryConnection } = require('../../src/modules/telemetry/controller')

test('buildMockGpsPing returns a well-shaped ping for the given driverId', () => {
  const ping = buildMockGpsPing('driver-123')

  assert.equal(ping.driverId, 'driver-123')
  assert.equal(typeof ping.lat, 'number')
  assert.equal(typeof ping.lng, 'number')
  assert.equal(typeof ping.speed, 'number')
  assert.ok(ping.speed >= 0 && ping.speed <= 90)
  assert.ok(!Number.isNaN(Date.parse(ping.timestamp)))
})

test('buildMockGpsPing produces varying values across calls', () => {
  const pings = Array.from({ length: 5 }, () => buildMockGpsPing('driver-1'))
  const uniqueLatLng = new Set(pings.map((p) => `${p.lat},${p.lng}`))
  assert.ok(uniqueLatLng.size > 1, 'expected randomized lat/lng across pings')
})

function buildFakeSocket () {
  const sent = []
  const listeners = {}
  return {
    OPEN: 1,
    readyState: 1,
    send: (payload) => sent.push(payload),
    on (event, cb) { listeners[event] = cb },
    emit (event) { if (listeners[event]) listeners[event]() },
    get sent () { return sent }
  }
}

test('handleTelemetryConnection sends a ping every intervalMs', async () => {
  const socket = buildFakeSocket()
  const interval = handleTelemetryConnection(socket, {}, { driverId: 'driver-x', intervalMs: 10 })

  await new Promise((resolve) => setTimeout(resolve, 35))
  clearInterval(interval)

  assert.ok(socket.sent.length >= 2, `expected multiple pings, got ${socket.sent.length}`)
  const parsed = JSON.parse(socket.sent[0])
  assert.equal(parsed.driverId, 'driver-x')
})

test('handleTelemetryConnection stops sending after socket close event', async () => {
  const socket = buildFakeSocket()
  handleTelemetryConnection(socket, {}, { driverId: 'driver-y', intervalMs: 10 })

  await new Promise((resolve) => setTimeout(resolve, 25))
  const countBeforeClose = socket.sent.length
  socket.emit('close')
  socket.readyState = 3 // CLOSED

  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(socket.sent.length, countBeforeClose, 'no more pings should be sent after close')
})

test('handleTelemetryConnection assigns a random driverId when none provided', async () => {
  const socket = buildFakeSocket()
  const interval = handleTelemetryConnection(socket, {}, { intervalMs: 10 })

  await new Promise((resolve) => setTimeout(resolve, 15))
  clearInterval(interval)

  const parsed = JSON.parse(socket.sent[0])
  assert.match(parsed.driverId, /^[0-9a-f-]{36}$/)
})
