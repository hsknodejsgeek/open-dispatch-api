'use strict'

// Lightweight schema sync for local/dev use: validates env, connects to
// Postgres, and brings the schema in line with the Sequelize model
// definitions (User, Driver, Delivery). Intended to run after
// `docker-compose up -d` and before `npm run dev`.
//
// Not a substitute for a real migration framework in a production
// deployment (no per-change history, no rollback) — for this portfolio
// project's scope, syncing models directly is sufficient.

require('dotenv').config()
const { envSchema } = require('../src/config/env')
const { createSequelize } = require('../src/sequelize')
const { initModels } = require('../src/sequelize/models')
const Ajv = require('ajv')

function loadConfig () {
  const ajv = new Ajv({ useDefaults: true, coerceTypes: true })
  const validate = ajv.compile(envSchema)
  const config = { ...process.env }
  const valid = validate(config)
  if (!valid) {
    console.error('Invalid environment configuration:', validate.errors)
    process.exit(1)
  }
  return config
}

async function main () {
  const config = loadConfig()
  const sequelize = createSequelize(config)
  initModels(sequelize)

  await sequelize.authenticate()
  console.log(`Connected to ${config.DB_NAME}@${config.DB_HOST}:${config.DB_PORT}`)

  await sequelize.sync({ alter: true })
  console.log('Schema synced (User, Driver, Delivery tables up to date).')

  await sequelize.close()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
