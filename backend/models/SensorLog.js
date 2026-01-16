const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Sensor = require('./Sensor');

const SensorLog = sequelize.define('SensorLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sensor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Sensor,
      key: 'id'
    }
  },
  detected: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'sensor_logs',
  timestamps: false
});

// Relations
Sensor.hasMany(SensorLog, { foreignKey: 'sensor_id' });
SensorLog.belongsTo(Sensor, { foreignKey: 'sensor_id' });

module.exports = SensorLog;