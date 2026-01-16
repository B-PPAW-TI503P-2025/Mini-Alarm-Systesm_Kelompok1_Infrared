const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import Database & Models
// Pastikan file config/database.js kamu sudah benar mengekspor instance sequelize
const sequelize = require('./config/database');

// Import Models (Penting di-load agar sequelize mengenali tabelnya sebelum sync)
require('./models/User');
require('./models/Sensor');
require('./models/SensorLog');

// Import Routes
const authRoutes = require('./routes/auth');     // Ini file routes/auth.js
const sensorRoutes = require('./routes/sensor'); // Ini file routes/sensor.js
const adminRoutes = require('./routes/admin');   // Ini file routes/admin.js

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors()); // Agar frontend bisa akses backend
app.use(express.json()); // Agar bisa baca JSON dari body request

// --- Routes ---
app.use('/api/auth', authRoutes);     // Endpoint: /api/auth/login, /api/auth/register
app.use('/api/sensor', sensorRoutes); // Endpoint: /api/sensor/stream, /api/sensor/stats
app.use('/api/admin', adminRoutes);   // Endpoint: /api/admin/users, /api/admin/dashboard

// --- Health Check ---
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Smart IR Monitoring System API is Ready',
    version: '1.0.0',
    server_time: new Date().toISOString()
  });
});

// --- Database Connection & Server Start ---
const startServer = async () => {
  try {
    // 1. Cek koneksi database
    await sequelize.authenticate();
    console.log('✅ Database connected successfully.');

    // 2. Sinkronisasi Tabel (Create table if not exists)
    // Gunakan { alter: true } jika ingin update struktur tabel tanpa hapus data
    await sequelize.sync({ alter: false }); 
    console.log('✅ Database models synchronized.');

    // 3. Jalankan Server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n==================================================`);
      console.log(`🚀 SERVER RUNNING ON: http://localhost:${PORT}`);
      console.log(`📡 REAL-TIME STREAM : http://localhost:${PORT}/api/sensor/stream`);
      console.log(`==================================================\n`);
    });

  } catch (err) {
    console.error('❌ Unable to start server:', err.message);
    process.exit(1); // Stop process jika DB error
  }
};

startServer();

// --- Graceful Shutdown (Biar stop-nya rapi) ---
process.on('SIGINT', async () => {
  console.log('\n👋 Closing server...');
  try {
    await sequelize.close();
    console.log('✅ Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});