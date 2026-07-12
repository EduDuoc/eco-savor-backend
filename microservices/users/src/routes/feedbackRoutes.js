const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');

// Publico - cualquiera puede enviar feedback
router.post('/', feedbackController.createFeedback);

// Solo admin - listar y marcar revisado
router.get('/', feedbackController.getAllFeedback);
router.put('/:id/reviewed', feedbackController.markAsReviewed);

module.exports = router;