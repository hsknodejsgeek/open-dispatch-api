'use strict'

const { Sequelize } = require('sequelize')

/**
 * Builds a Sequelize instance from validated fastify.config.
 * @param {object} config - validated env config (fastify.config)
 * @returns {Sequelize}
 */
function createSequelize (config) {
  return new Sequelize(config.DB_NAME, config.DB_USER, config.DB_PASSWORD, {
    host: config.DB_HOST,
    port: config.DB_PORT,
    dialect: 'postgres',
    logging: config.NODE_ENV === 'development' ? console.log : false,
    define: {
      underscored: true,
      timestamps: true
    }
  })
}

module.exports = { createSequelize }
