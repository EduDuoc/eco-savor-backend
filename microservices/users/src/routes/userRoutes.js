const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

/**
 * Rutas públicas (no requieren autenticación)
 */
router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/restaurants', userController.getRestaurants);

/**
 * Rutas protegidas (requieren autenticación)
 * Se implementará middleware de auth después
 */
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
