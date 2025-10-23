require('dotenv').config();
console.log('✓ Environment variables loaded');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

console.log('✓ Dependencies loaded');

const app = express();
const PORT = process.env.PORT || 4001;

console.log(`✓ Express app created, will use PORT ${PORT}`);

// Middleware - CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
  'https://sales-tracker-client.onrender.com'
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Morgan logging - only in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
console.log('Loading routes...');
const authRoutes = require('./routes/authRoutes');
console.log('✓ authRoutes loaded');
const userRoutes = require('./routes/userRoutes');
console.log('✓ userRoutes loaded');
const outreachRoutes = require('./routes/outreachRoutes');
console.log('✓ outreachRoutes loaded');
const jobPostingRoutes = require('./routes/jobPostingRoutes');
console.log('✓ jobPostingRoutes loaded');
const adminRoutes = require('./routes/adminRoutes');
console.log('✓ adminRoutes loaded');
const builderRoutes = require('./routes/builderRoutes');
console.log('✓ builderRoutes loaded');
const activityRoutes = require('./routes/activityRoutes');
console.log('✓ activityRoutes loaded');
const jobPostingBuilderRoutes = require('./routes/jobPostingBuilderRoutes');
console.log('✓ jobPostingBuilderRoutes loaded');
const linkedinAuthRoutes = require('./routes/linkedinAuthRoutes');
console.log('✓ linkedinAuthRoutes loaded');
const dashboardRoutes = require('./routes/dashboardRoutes');
console.log('✓ dashboardRoutes loaded');

// API endpoints
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/job-postings', jobPostingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/builders', builderRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/applications', jobPostingBuilderRoutes);
app.use('/api/linkedin-auth', linkedinAuthRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check hit');
  res.json({ status: 'ok', message: 'Sales Tracker API is running' });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint hit');
  res.json({ test: 'success', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;

