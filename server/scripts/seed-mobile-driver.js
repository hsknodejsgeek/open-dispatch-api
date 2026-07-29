'use strict'

// One-off script to create/reset the demo driver login used by the Expo
// mobile app (open-dispatch-mobile), plus a handful of deliveries assigned
// to them so the Assigned Jobs screen has real data instead of falling
// back to src/mocks/jobs.json.
//
// Run with: node scripts/seed-mobile-driver.js
// Requires your local Postgres (see .env) to be running and migrated
// (npm run migrate).
//
// Credentials are documented in docs/mobile UI/seed-credentials.md — keep
// that file in sync if you change EMAIL/PASSWORD/VEHICLE_NO below.

require('dotenv').config()
const Ajv = require('ajv')
const bcrypt = require('bcrypt')
const { envSchema } = require('../src/config/env')
const { createSequelize } = require('../src/sequelize')
const { initModels } = require('../src/sequelize/models')

const EMAIL = 'driver@opendispatch.test'
const PASSWORD = 'DriverPass123!'
const ROLE = 'DRIVER'
const VEHICLE_NO = 'VAN-42'
const DRIVER_STATUS = 'ON_TRIP'
// Roughly downtown San Francisco — matches the mock bounding box the
// telemetry websocket plugin uses for its simulated GPS pings.
const START_LAT = 37.7897
const START_LNG = -122.3972

const SAMPLE_DELIVERIES = [
  {
    pickupAddress: '450 Townsend St, San Francisco, CA',
    deliveryAddress: '1 Ferry Building, San Francisco, CA',
    status: 'PENDING',
    priority: 'HIGH'
  },
  {
    pickupAddress: '1 Market St, San Francisco, CA',
    deliveryAddress: '555 California St, San Francisco, CA',
    status: 'IN_TRANSIT',
    priority: 'MEDIUM'
  },
  {
    pickupAddress: '2 Marina Blvd, San Francisco, CA',
    deliveryAddress: '3810 Judah St, San Francisco, CA',
    status: 'DELIVERED',
    priority: 'LOW'
  },
  {
    pickupAddress: '899 Valencia St, San Francisco, CA',
    deliveryAddress: '1200 3rd St, San Francisco, CA',
    status: 'PENDING',
    priority: 'HIGH'
  }
]

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

function randomTrackingNumber () {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `TRK-${digits}`
}

async function main () {
  const config = loadConfig()
  const sequelize = createSequelize(config)
  const models = initModels(sequelize)

  await sequelize.authenticate()
  await sequelize.sync() // ensure tables exist without altering existing schema

  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const [user, userCreated] = await models.User.findOrCreate({
    where: { email: EMAIL },
    defaults: { passwordHash, role: ROLE }
  })

  if (!userCreated) {
    user.passwordHash = passwordHash
    user.role = ROLE
    await user.save()
    console.log(`Updated existing user ${EMAIL}`)
  } else {
    console.log(`Created user ${EMAIL}`)
  }

  const [driver, driverCreated] = await models.Driver.findOrCreate({
    where: { userId: user.id },
    defaults: {
      vehicleNo: VEHICLE_NO,
      status: DRIVER_STATUS,
      currentLat: START_LAT,
      currentLng: START_LNG
    }
  })

  if (!driverCreated) {
    driver.vehicleNo = VEHICLE_NO
    driver.status = DRIVER_STATUS
    await driver.save()
    console.log(`Updated existing driver profile (vehicle ${VEHICLE_NO})`)
  } else {
    console.log(`Created driver profile (vehicle ${VEHICLE_NO})`)
  }

  const existingCount = await models.Delivery.count({ where: { driverId: driver.id } })
  if (existingCount > 0) {
    console.log(`Driver already has ${existingCount} assigned deliveries, skipping sample seed`)
  } else {
    for (const sample of SAMPLE_DELIVERIES) {
      await models.Delivery.create({
        ...sample,
        driverId: driver.id,
        trackingNumber: randomTrackingNumber()
      })
    }
    console.log(`Created ${SAMPLE_DELIVERIES.length} sample deliveries assigned to this driver`)
  }

  console.log('\nMobile app login credentials:')
  console.log(`  email:    ${EMAIL}`)
  console.log(`  password: ${PASSWORD}`)
  console.log(`\nDriver profile: vehicle ${VEHICLE_NO}, status ${DRIVER_STATUS}, driver id ${driver.id}`)

  await sequelize.close()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
