const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
// Rutas públicas
router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/restaurants', userController.getRestaurants);
// Rutas que requieren autenticación (se implementará después)
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
module.exports = router;