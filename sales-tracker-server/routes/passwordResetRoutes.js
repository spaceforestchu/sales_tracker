const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/passwordResetController');

// Request password reset (send email)
router.post('/request', passwordResetController.requestPasswordReset);

// Reset password with token
router.post('/reset', passwordResetController.resetPassword);

// Validate reset token
router.get('/validate/:token', passwordResetController.validateResetToken);

module.exports = router;