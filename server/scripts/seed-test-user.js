'use strict'

// One-off script to create/reset a test login credential.
// Run with: node scripts/seed-test-user.js
// Requires your local Postgres (see .env) to be running and migrated (npm run migrate, if present).

require('dotenv').config()
const Ajv = require('ajv')
const bcrypt = require('bcrypt')
const { envSchema } = require('../src/config/env')
const { createSequelize } = require('../src/sequelize')
const { initModels } = require('../src/sequelize/models')

const EMAIL = 'test@example.com'
const PASSWORD = 'Password123!'
const ROLE = 'DISPATCHER' // or 'DRIVER'

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
  const models = initModels(sequelize)

  await sequelize.authenticate()
  await sequelize.sync() // ensure the users table exists without altering existing schema

  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const [user, created] = await models.User.findOrCreate({
    where: { email: EMAIL },
    defaults: { passwordHash, role: ROLE }
  })

  if (!created) {
    user.passwordHash = passwordHash
    user.role = ROLE
    await user.save()
    console.log(`Updated existing user ${EMAIL}`)
  } else {
    console.log(`Created user ${EMAIL}`)
  }

  console.log('\nLogin credentials:')
  console.log(`  email:    ${EMAIL}`)
  console.log(`  password: ${PASSWORD}`)

  await sequelize.close()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
