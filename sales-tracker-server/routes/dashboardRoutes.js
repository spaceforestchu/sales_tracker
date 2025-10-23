const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/auth');

// All dashboard routes require authentication
router.use(auth);

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);

// GET /api/dashboard/closed-won - Get closed won jobs
router.get('/closed-won', dashboardController.getClosedWonJobs);

// GET /api/dashboard/outreach - Get outreach for dashboard
router.get('/outreach', dashboardController.getOutreachForDashboard);

module.exports = router;
