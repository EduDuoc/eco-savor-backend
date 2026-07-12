const Feedback = require('../models/feedbackModel');

/**
 * Crear feedback - Publico, sin autenticacion
 * POST /api/feedback
 */
exports.createFeedback = async (req, res) => {
  try {
    const { name, email, phone, message, type } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Nombre, email y mensaje son obligatorios',
      });
    }

    const feedback = await Feedback.create({ name, email, phone, message, type });

    res.status(201).json({
      success: true,
      message: 'Gracias por tu mensaje, nuestro equipo te contactara pronto',
      data: feedback,
    });
  } catch (error) {
    console.error('Error al crear feedback:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Listar todos los feedback - Solo admin
 * GET /api/feedback
 */
exports.getAllFeedback = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden acceder a este recurso',
      });
    }

    const feedbackList = await Feedback.find({}).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: feedbackList.length,
      data: feedbackList,
    });
  } catch (error) {
    console.error('Error al obtener feedback:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Marcar feedback como revisado - Solo admin
 * PUT /api/feedback/:id/reviewed
 */
exports.markAsReviewed = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden acceder a este recurso',
      });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status: 'reviewed' },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback no encontrado' });
    }

    res.json({ success: true, data: feedback });
  } catch (error) {
    console.error('Error al actualizar feedback:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};