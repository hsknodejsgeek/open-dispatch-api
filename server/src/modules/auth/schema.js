'use strict'

const { Type } = require('@sinclair/typebox')

const ROLE_VALUES = ['DISPATCHER', 'DRIVER']

const loginBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 })
})

const userPublicSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  role: Type.Enum(Object.fromEntries(ROLE_VALUES.map((v) => [v, v])))
})

/**
 * accessToken/refreshToken are only present in the response body for mobile
 * clients (`X-Client-Type: mobile`). Web clients get both tokens set as
 * httpOnly cookies instead and the body only carries `user` — see
 * controller.js for the branching logic.
 */
const loginResponseSchema = Type.Object({
  accessToken: Type.Optional(Type.String()),
  refreshToken: Type.Optional(Type.String()),
  user: userPublicSchema
})

// Only used by mobile clients, which can't rely on an httpOnly cookie and
// must send the refresh token back explicitly.
const refreshBodySchema = Type.Object({
  refreshToken: Type.Optional(Type.String())
})

const refreshResponseSchema = Type.Object({
  accessToken: Type.Optional(Type.String()),
  refreshToken: Type.Optional(Type.String()),
  user: userPublicSchema
})

const logoutResponseSchema = Type.Object({
  success: Type.Boolean()
})

const DRIVER_STATUS_VALUES = ['IDLE', 'ON_TRIP']

const driverPublicSchema = Type.Object({
  id: Type.String(),
  vehicleNo: Type.String(),
  status: Type.Enum(Object.fromEntries(DRIVER_STATUS_VALUES.map((v) => [v, v]))),
  currentLat: Type.Union([Type.Number(), Type.Null()]),
  currentLng: Type.Union([Type.Number(), Type.Null()])
})

// GET /v1/auth/me — same public user shape as login/refresh, plus the
// driver profile (null for DISPATCHER accounts, or a DRIVER with no
// linked Driver row yet).
const meResponseSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  role: Type.Enum(Object.fromEntries(ROLE_VALUES.map((v) => [v, v]))),
  driver: Type.Union([driverPublicSchema, Type.Null()])
})

module.exports = {
  ROLE_VALUES,
  DRIVER_STATUS_VALUES,
  loginBodySchema,
  loginResponseSchema,
  refreshBodySchema,
  refreshResponseSchema,
  logoutResponseSchema,
  userPublicSchema,
  driverPublicSchema,
  meResponseSchema
}
