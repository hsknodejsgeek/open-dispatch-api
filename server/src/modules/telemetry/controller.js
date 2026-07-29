'use strict'

const crypto = require('node:crypto')

const PING_INTERVAL_MS = 3000

// Rough bounding box + speed range used to synthesize plausible-looking
// mock GPS pings. Not tied to any real geography.
const LAT_RANGE = [37.70, 37.82]
const LNG_RANGE = [-122.51, -122.36]
const SPEED_RANGE_KPH = [0, 90]

function randomInRange ([min, max]) {
  return min + Math.random() * (max - min)
}

/**
 * Builds a single mock GPS ping payload for a driver.
 *
 * @param {string} driverId
 * @returns {{driverId: string, lat: number, lng: number, speed: number, timestamp: string}}
 */
function buildMockGpsPing (driverId) {
  return {
    driverId,
    lat: Number(randomInRange(LAT_RANGE).toFixed(6)),
    lng: Number(randomInRange(LNG_RANGE).toFixed(6)),
    speed: Number(randomInRange(SPEED_RANGE_KPH).toFixed(1)),
    timestamp: new Date().toISOString()
  }
}

/**
 * Handles a GET /v1/telemetry/ws WebSocket connection: every
 * PING_INTERVAL_MS, sends a mock GPS ping as a JSON string over the socket.
 * The interval is cleared when the socket closes or errors, so no timers
 * leak past connection lifetime.
 *
 * @param {import('ws').WebSocket} socket
 * @param {import('fastify').FastifyRequest} request
 * @param {{driverId?: string, intervalMs?: number}} [opts]
 * @returns {NodeJS.Timeout} the interval handle (mainly useful for tests)
 */
function handleTelemetryConnection (socket, request, opts = {}) {
  const driverId = opts.driverId || crypto.randomUUID()
  const intervalMs = opts.intervalMs || PING_INTERVAL_MS

  const interval = setInterval(() => {
    if (socket.readyState !== socket.OPEN) {
      clearInterval(interval)
      return
    }
    socket.send(JSON.stringify(buildMockGpsPing(driverId)))
  }, intervalMs)

  socket.on('close', () => clearInterval(interval))
  socket.on('error', () => clearInterval(interval))

  return interval
}

module.exports = {
  handleTelemetryConnection,
  buildMockGpsPing,
  PING_INTERVAL_MS
}
