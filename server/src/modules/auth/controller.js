'use strict'

const COOKIE_NAME = 'token'
const TOKEN_TTL_SECONDS = 60 * 60 // 1 hour

/**
 * Handles POST /v1/auth/login.
 *
 * Depends on the following being available on `fastify`:
 *   - fastify.models.User   (sequelize plugin)
 *   - fastify.bcrypt        (bcrypt plugin)
 *   - fastify.jwt           (jwt plugin)
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

  const accessToken = fastify.jwt.sign(
    { userId: user.id, role: user.role },
    { expiresIn: TOKEN_TTL_SECONDS }
  )

  reply.setCookie(COOKIE_NAME, accessToken, {
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure: fastify.config.NODE_ENV === 'production',
    maxAge: TOKEN_TTL_SECONDS
  })

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  }
}

module.exports = { login, COOKIE_NAME }
