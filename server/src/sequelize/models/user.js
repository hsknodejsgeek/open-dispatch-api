'use strict'

const { DataTypes, Model } = require('sequelize')

class User extends Model {
  static init (sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'password_hash'
      },
      role: {
        type: DataTypes.ENUM('DISPATCHER', 'DRIVER'),
        allowNull: false,
        defaultValue: 'DISPATCHER'
      }
    }, {
      sequelize,
      modelName: 'User',
      tableName: 'users'
    })
  }

  static associate (models) {
    User.hasOne(models.Driver, { foreignKey: 'userId', as: 'driver' })
  }
}

module.exports = User
