'use strict'

const ACCESS_COOKIE_NAME = 'token'
const REFRESH_COOKIE_NAME = 'refreshToken'
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60 // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

/**
 * Web browsers get both tokens as httpOnly cookies and never see the raw
 * token values (mitigates XSS token theft). Native mobile apps have no
 * cookie jar in the same sense and store tokens themselves (e.g. Keychain/
 * Keystore), so they get the tokens back in the JSON body instead. Clients
 * opt into the mobile behavior with `X-Client-Type: mobile`; anything else
 * (including no header at all) is treated as web, since that's the more
 * secure default.
 *
 * @param {import('fastify').FastifyRequest} request
 * @returns {'web' | 'mobile'}
 */
function getClientType (request) {
  const header = request.headers?.['x-client-type']
  return header && header.toLowerCase() === 'mobile' ? 'mobile' : 'web'
}

function toPublicUser (user) {
  return { id: user.id, email: user.email, role: user.role }
}

function signAccessToken (fastify, user) {
  return fastify.jwt.sign(
    { userId: user.id, role: user.role },
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  )
}

function signRefreshToken (fastify, user) {
  return fastify.jwt.refresh.sign(
    { userId: user.id, type: 'refresh' },
    { expiresIn: REFRESH_TOKEN_TTL_SECONDS }
  )
}

function setAuthCookies (fastify, reply, { accessToken, refreshToken }) {
  const secure = fastify.config.NODE_ENV === 'production'

  reply.setCookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure,
    maxAge: ACCESS_TOKEN_TTL_SECONDS
  })

  // Scoped to /v1/auth since that's the only place a refresh token needs to
  // be sent — narrows the blast radius if it were ever exfiltrated.
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    path: '/v1/auth',
    sameSite: 'strict',
    secure,
    maxAge: REFRESH_TOKEN_TTL_SECONDS
  })
}

function clearAuthCookies (reply) {
  reply.clearCookie(ACCESS_COOKIE_NAME, { path: '/' })
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/v1/auth' })
}

/**
 * Handles POST /v1/auth/login.
 *
 * Depends on the following being available on `fastify`:
 *   - fastify.models.User   (sequelize plugin)
 *   - fastify.bcrypt        (bcrypt plugin)
 *   - fastify.jwt           (jwt plugin, access + refresh namespaces)
 *   - fastify.config        (env plugin)
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function login (fastify, request, reply) {
  const { email, password } = request.body

  const user = await fastify.models.User.findOne({ where: { email } })
  if (!user) {
    return reply.unauthorized('Invalid email or password')
  }

  const passwordMatches = await fastify.bcrypt.compare(password, user.passwordHash)
  if (!passwordMatches) {
    return reply.unauthorized('Invalid email or password')
  }

  const accessToken = signAccessToken(fastify, user)
  const refreshToken = signRefreshToken(fastify, user)
  const clientType = getClientType(request)

  if (clientType === 'mobile') {
    return { accessToken, refreshToken, user: toPublicUser(user) }
  }

  setAuthCookies(fastify, reply, { accessToken, refreshToken })
  return { user: toPublicUser(user) }
}

/**
 * Handles POST /v1/auth/refresh — exchanges a still-valid refresh token for
 * a new access token, rotating the refresh token in the process (issuing a
 * new one each time limits how long a stolen refresh token stays useful).
 *
 * Web clients present the refresh token via the httpOnly `refreshToken`
 * cookie (scoped to /v1/auth); mobile clients send it in the body.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function refresh (fastify, request, reply) {
  const clientType = getClientType(request)
  const token = clientType === 'mobile'
    ? request.body?.refreshToken
    : request.cookies?.[REFRESH_COOKIE_NAME]

  if (!token) {
    return reply.unauthorized('Missing refresh token')
  }

  let decoded
  try {
    decoded = fastify.jwt.refresh.verify(token)
  } catch {
    return reply.unauthorized('Invalid or expired refresh token')
  }

  if (decoded.type !== 'refresh') {
    return reply.unauthorized('Invalid refresh token')
  }

  const user = await fastify.models.User.findByPk(decoded.userId)
  if (!user) {
    return reply.unauthorized('Invalid refresh token')
  }

  const accessToken = signAccessToken(fastify, user)
  const refreshToken = signRefreshToken(fastify, user)

  if (clientType === 'mobile') {
    return { accessToken, refreshToken, user: toPublicUser(user) }
  }

  setAuthCookies(fastify, reply, { accessToken, refreshToken })
  return { user: toPublicUser(user) }
}

/**
 * Handles POST /v1/auth/logout. Stateless JWTs can't be revoked server-side
 * without a token blocklist, so this just clears the web auth cookies;
 * mobile clients are responsible for discarding their stored tokens.
 *
 * @param {import('fastify').FastifyReply} reply
 */
async function logout (fastify, request, reply) {
  clearAuthCookies(reply)
  return { success: true }
}

function toPublicDriver (driver) {
  if (!driver) return null
  const plain = typeof driver.get === 'function' ? driver.get({ plain: true }) : driver
  return {
    id: plain.id,
    vehicleNo: plain.vehicleNo,
    status: plain.status,
    currentLat: plain.currentLat ?? null,
    currentLng: plain.currentLng ?? null
  }
}

/**
 * Handles GET /v1/auth/me — returns the authenticated user (from the
 * verified access token's `userId`, set on `request.user` by
 * `fastify.authenticate`) plus their driver profile, if any. Used by the
 * mobile app to refresh user/driver details on app open without requiring
 * a fresh login.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
async function me (fastify, request, reply) {
  const user = await fastify.models.User.findByPk(request.user.userId, {
    include: [{ association: 'driver' }]
  })
  if (!user) {
    return reply.unauthorized('User no longer exists')
  }

  const plain = user.get({ plain: true })
  return {
    id: plain.id,
    email: plain.email,
    role: plain.role,
    driver: toPublicDriver(plain.driver)
  }
}

module.exports = {
  login,
  refresh,
  logout,
  me,
  getClientType,
  toPublicUser,
  toPublicDriver,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS
}
