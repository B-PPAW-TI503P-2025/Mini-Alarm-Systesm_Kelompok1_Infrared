const express = require('express');
const { Op } = require('sequelize'); // Pastikan Op diimport untuk cleanup logs
const User = require('../models/User');
const Sensor = require('../models/Sensor');
const SensorLog = require('../models/SensorLog');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

const router = express.Router();

// Semua route admin harus authenticated + role admin
router.use(auth);
router.use(checkRole('admin'));

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'is_active', 'created_at', 'last_login']
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Toggle user status (UPDATE: Prevent self-deactivation)
router.patch('/users/:id/toggle', async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const currentAdminId = req.user.id; // Dari middleware auth

    // 1. Cek apakah admin mencoba mematikan akunnya sendiri
    if (targetUserId === currentAdminId) {
      return res.status(400).json({ 
        message: 'Akses ditolak: Anda tidak dapat menonaktifkan akun sendiri.' 
      });
    }

    const user = await User.findByPk(targetUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Toggle status
    await user.update({ is_active: !user.is_active });
    
    res.json({ 
      message: `User ${user.username} is now ${!user.is_active ? 'Inactive' : 'Active'}`, 
      is_active: user.is_active 
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all sensors
router.get('/sensors', async (req, res) => {
  try {
    const sensors = await Sensor.findAll();
    res.json(sensors);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update sensor
router.patch('/sensors/:id', async (req, res) => {
  try {
    const { location, status } = req.body;
    const sensor = await Sensor.findByPk(req.params.id);
    
    if (!sensor) {
      return res.status(404).json({ message: 'Sensor not found' });
    }

    await sensor.update({ location, status });
    res.json({ message: 'Sensor updated', sensor });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete old logs
router.delete('/logs/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const deleted = await SensorLog.destroy({
      where: {
        timestamp: { [Op.lt]: cutoffDate }
      }
    });

    res.json({ message: 'Cleanup completed', deleted });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export logs to CSV
router.get('/export/logs', async (req, res) => {
  try {
    const logs = await SensorLog.findAll({
      include: [{ model: Sensor }],
      order: [['timestamp', 'DESC']],
      limit: 10000 // Max 10k records
    });

    let csv = 'ID,Sensor Code,Location,Detected,Timestamp\n';
    logs.forEach(log => {
      // Handle jika sensor terhapus (opsional check)
      const sensorCode = log.Sensor ? log.Sensor.sensor_code : 'DELETED';
      const sensorLoc = log.Sensor ? log.Sensor.location : 'UNKNOWN';
      
      csv += `${log.id},${sensorCode},${sensorLoc},${log.detected},${log.timestamp}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sensor_logs.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Dashboard stats for admin
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { is_active: true } });
    const totalSensors = await Sensor.count();
    const activeSensors = await Sensor.count({ where: { status: 'active' } });
    const totalLogs = await SensorLog.count();

    res.json({
      users: { total: totalUsers, active: activeUsers },
      sensors: { total: totalSensors, active: activeSensors },
      logs: totalLogs
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;