const { User } = require('./models');
const sequelize = require('./config/database');

async function resetAdmin() {
  try {
    await sequelize.authenticate();
    
    // 1. Hapus user admin yang lama (jika ada)
    await User.destroy({ where: { username: 'user1' } });
    console.log('🗑️  User user1 lama dihapus.');

    // 2. Buat ulang user admin (Tanpa enkripsi manual di sini)
    // Kita biarkan User.js yang mengurus enkripsinya
    await User.create({
      username: 'user1',
      password: 'password123', // Kirim password polos
      role: 'user',
      email: 'user@example.com',
      is_active: true
    });

    console.log('✅ User user1 baru dibuat!');
    console.log('👉 Coba login dengan: user1 / password123');

  } catch (error) {
    console.error('❌ Gagal reset:', error);
  } finally {
    await sequelize.close();
  }
}

resetAdmin();