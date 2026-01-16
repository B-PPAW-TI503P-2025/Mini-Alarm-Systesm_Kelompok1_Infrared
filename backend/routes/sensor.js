const express = require('express');
const { Op } = require('sequelize');
const Sensor = require('../models/Sensor');
const SensorLog = require('../models/SensorLog');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/role');

const router = express.Router();

// SSE Clients Management
let clients = [];

const broadcastUpdate = (data) => {
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};

// SSE Stream Endpoint
router.get('/stream', (req, res) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*'
  };
  res.writeHead(200, headers);

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  // Send initial connection success
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE Connected' })}\n\n`);

  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
    console.log(`Client ${clientId} disconnected`);
  });
});

// ESP32 Data Endpoint - FIXED
router.post('/data', async (req, res) => {
  try {
    console.log('📡 Received data:', req.body);
    
    const { sensor_id, detected } = req.body;

    if (!sensor_id) {
      return res.status(400).json({ message: 'sensor_id required' });
    }

    // 1. Find or Create Sensor
    let sensor = await Sensor.findOne({ where: { sensor_code: sensor_id } });
    
    if (!sensor) {
      sensor = await Sensor.create({
        sensor_code: sensor_id,
        location: 'Auto-Registered Device',
        status: 'active'
      });
      console.log('✅ New sensor registered:', sensor_id);
    }

    // 2. Update last_seen
    await sensor.update({ last_seen: new Date() });

    // 3. Save Log to Database
    const newLog = await SensorLog.create({
      sensor_id: sensor.id,
      detected: detected === 1 || detected === true,
      timestamp: new Date()
    });

    console.log('✅ Log saved:', newLog.id, 'Detected:', newLog.detected);

    // 4. Broadcast to Dashboard
    const broadcastData = {
      type: 'update',
      sensor: sensor.sensor_code,
      location: sensor.location,
      detected: newLog.detected,
      timestamp: newLog.timestamp
    };
    broadcastUpdate(broadcastData);

    res.status(201).json({ 
      success: true,
      message: 'Data received',
      log_id: newLog.id 
    });

  } catch (error) {
    console.error('❌ Sensor Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});

// Dashboard Stats
router.get('/stats', auth, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await SensorLog.count({
      where: {
        detected: true,
        timestamp: { [Op.gte]: startOfDay }
      }
    });

    const totalCount = await SensorLog.count({
      where: { detected: true }
    });

    const lastLog = await SensorLog.findOne({
      where: { detected: true },
      order: [['timestamp', 'DESC']],
      include: [{ model: Sensor }]
    });

    res.json({
      today: todayCount,
      total: totalCount,
      lastDetection: lastLog ? lastLog.timestamp : null,
      lastSensor: lastLog ? lastLog.Sensor?.sensor_code : null
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Hourly Activity Chart Data
router.get('/activity/hourly', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await SensorLog.findAll({
      where: {
        timestamp: { [Op.gte]: today },
        detected: true
      }
    });

    const activityMap = new Array(24).fill(0);

    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const hourString = date.toLocaleString('en-US', { 
        timeZone: 'Asia/Jakarta', 
        hour: 'numeric', 
        hour12: false 
      });
      const hour = parseInt(hourString);
      
      if (hour >= 0 && hour < 24) {
        activityMap[hour]++;
      }
    });

    const hours = Array.from({ length: 24 }, (_, i) => 
      `${i.toString().padStart(2, '0')}:00`
    );

    res.json({
      hours: hours,
      detections: activityMap
    });

  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Recent Logs
router.get('/logs', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const logs = await SensorLog.findAll({
      include: [{ 
        model: Sensor, 
        attributes: ['sensor_code', 'location'] 
      }],
      order: [['timestamp', 'DESC']],
      limit: limit
    });

    res.json({ data: logs });

  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export CSV endpoint (Admin only)
router.get('/export/logs', auth, checkRole('admin'), async (req, res) => {
  try {
    const logs = await SensorLog.findAll({
      include: [{ 
        model: Sensor,
        attributes: ['sensor_code', 'location']
      }],
      order: [['timestamp', 'DESC']],
      limit: 10000 // Max 10k records
    });

    // Create CSV Header
    let csv = 'ID,Timestamp,Sensor Code,Location,Status\n';
    
    // Add data rows
    logs.forEach(log => {
      const timestamp = new Date(log.timestamp).toLocaleString('id-ID');
      const sensorCode = log.Sensor ? log.Sensor.sensor_code : 'DELETED';
      const sensorLoc = log.Sensor ? log.Sensor.location : 'UNKNOWN';
      const status = log.detected ? 'DETECTED' : 'CLEAR';
      
      // Escape commas in location names
      const escapedLoc = sensorLoc.includes(',') ? `"${sensorLoc}"` : sensorLoc;
      
      csv += `${log.id},${timestamp},${sensorCode},${escapedLoc},${status}\n`;
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=sensor_logs_' + Date.now() + '.csv');
    res.send(csv);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

module.exports = router;