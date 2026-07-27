'use strict'

const User = require('./user')
const Driver = require('./driver')
const Delivery = require('./delivery')

/**
 * Initializes all models against a Sequelize instance and wires associations.
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {{User: typeof User, Driver: typeof Driver, Delivery: typeof Delivery}}
 */
function initModels (sequelize) {
  User.init(sequelize)
  Driver.init(sequelize)
  Delivery.init(sequelize)

  const models = { User, Driver, Delivery }

  Object.values(models).forEach((model) => {
    if (typeof model.associate === 'function') {
      model.associate(models)
    }
  })

  return models
}

module.exports = { initModels, User, Driver, Delivery }
