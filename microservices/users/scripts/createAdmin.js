require('dotenv').config();
const connectDB = require('../src/config/database');
const User = require('../src/models/userModel');

const createAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('Faltan variables de entorno ADMIN_EMAIL y/o ADMIN_PASSWORD');
    process.exit(1);
  }

  try {
    await connectDB();

    let user = await User.findOne({ email: adminEmail.toLowerCase().trim() });

    if (user) {
      user.name = 'Angie - Gerente General';
      user.role = 'admin';
      user.password = adminPassword;
      await user.save();
      console.log(`✅ Usuario administrador actualizado: ${user.email}`);
    } else {
      user = new User({
        email: adminEmail.toLowerCase().trim(),
        password: adminPassword,
        name: 'Angie - Gerente General',
        role: 'admin'
      });
      await user.save();
      console.log(`✅ Usuario administrador creado: ${user.email}`);
    }
  } catch (error) {
    console.error('❌ Error al crear/actualizar el usuario administrador:', error.message);
    process.exit(1);
  } finally {
    await require('mongoose').disconnect();
    console.log('🔌 Conexión a MongoDB cerrada');
  }
};

createAdmin();
