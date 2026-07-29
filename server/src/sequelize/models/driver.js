'use strict'

const { DataTypes, Model } = require('sequelize')

class Driver extends Model {
  static init (sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id'
      },
      vehicleNo: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'vehicle_no'
      },
      status: {
        type: DataTypes.ENUM('IDLE', 'ON_TRIP'),
        allowNull: false,
        defaultValue: 'IDLE'
      },
      currentLat: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        field: 'current_lat'
      },
      currentLng: {
        type: DataTypes.DOUBLE,
        allowNull: true,
        field: 'current_lng'
      }
    }, {
      sequelize,
      modelName: 'Driver',
      tableName: 'drivers'
    })
  }

  static associate (models) {
    Driver.belongsTo(models.User, { foreignKey: 'userId', as: 'user' })
    Driver.hasMany(models.Delivery, { foreignKey: 'driverId', as: 'deliveries' })
  }
}

module.exports = Driver
