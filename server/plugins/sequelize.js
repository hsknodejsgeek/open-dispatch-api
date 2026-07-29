'use strict'

const fp = require('fastify-plugin')
const { createSequelize } = require('../src/sequelize')
const { initModels } = require('../src/sequelize/models')

/**
 * Connects to Postgres via Sequelize and decorates fastify.db / fastify.models.
 * Depends on the env plugin having populated fastify.config.
 */
module.exports = fp(async function (fastify, opts) {
  const sequelize = createSequelize(fastify.config)
  const models = initModels(sequelize)

  await sequelize.authenticate()
  fastify.log.info('database connection established')

  fastify.decorate('db', sequelize)
  fastify.decorate('models', models)

  fastify.addHook('onClose', async (instance) => {
    await instance.db.close()
  })
}, {
  name: 'sequelize',
  dependencies: ['env']
})
