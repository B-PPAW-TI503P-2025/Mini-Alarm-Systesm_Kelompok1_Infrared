const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Pastikan path model benar

// Import middleware yang baru saja kita perbaiki
const auth = require('../middleware/auth');      
const checkRole = require('../middleware/role'); 

const router = express.Router();

// --- LOGIN (Public) ---
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: 'Username atau password salah' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Akun dinonaktifkan oleh Admin' });
    }

    // Update Last Login
    user.last_login = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET || 'rahasia_negara',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// --- REGISTER (Admin Only) ---
// Perhatikan: Kita pakai variable 'auth' dan 'checkRole' di sini
router.post('/register', auth, checkRole('admin'), async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'Username sudah digunakan' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      role: role || 'user'
    });

    res.status(201).json({ message: 'User berhasil dibuat', user: newUser });
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat user', error: error.message });
  }
});

module.exports = router;