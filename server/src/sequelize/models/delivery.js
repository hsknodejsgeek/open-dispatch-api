'use strict'

const { DataTypes, Model } = require('sequelize')

class Delivery extends Model {
  static init (sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      trackingNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'tracking_number'
      },
      pickupAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'pickup_address'
      },
      deliveryAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'delivery_address'
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      priority: {
        type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH'),
        allowNull: false,
        defaultValue: 'MEDIUM'
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'driver_id'
      }
    }, {
      sequelize,
      modelName: 'Delivery',
      tableName: 'deliveries'
    })
  }

  static associate (models) {
    Delivery.belongsTo(models.Driver, { foreignKey: 'driverId', as: 'driver' })
  }
}

module.exports = Delivery
