'use strict'

const { Type } = require('@sinclair/typebox')

const loginBodySchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 })
})

const userPublicSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  role: Type.String()
})

const loginResponseSchema = Type.Object({
  accessToken: Type.String(),
  user: userPublicSchema
})

module.exports = {
  loginBodySchema,
  loginResponseSchema,
  userPublicSchema
}
