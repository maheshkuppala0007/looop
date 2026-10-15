const express = require('express');
const router = express.Router();

const healthRoutes = require('./healthRoutes');
const itemRoutes = require('./itemRoutes');
const categoryRoutes = require('./categoryRoutes');
const authRoutes = require('./authRoutes');
const savedRoutes = require('./savedRoutes');
const wantedRoutes = require('./wantedRoutes');
const requestRoutes = require('./requestRoutes');
const transactionRoutes = require('./transactionRoutes');
const conversationRoutes = require('./conversationRoutes');
const notificationRoutes = require('./notificationRoutes');
const userRoutes = require('./userRoutes');
const reviewRoutes = require('./reviewRoutes');
const reportRoutes = require('./reportRoutes');
const matchRoutes = require('./matchRoutes');
const adminRoutes = require('./adminRoutes');
const impactRoutes = require('./impactRoutes');
const pointsRoutes = require('./pointsRoutes');
const locationRoutes = require('./locationRoutes');
const mapRoutes = require('./mapRoutes');
const webhookRoutes = require('./webhookRoutes');
const contentRoutes = require('./contentRoutes');

// Health and Diagnostics
router.use('/health', healthRoutes);
router.use('/webhooks', webhookRoutes);

// Public CMS, Reviews, Impact & Newsletter Endpoints
router.use('/content', contentRoutes);
router.use('/subscribers', contentRoutes);

// Admin Portal REST API
router.use('/admin', adminRoutes);

// Auth, Users, Reviews, Reports, Items, Saved, Categories, Wanted, Requests, Transactions, Conversations, Notifications, Matches, Points, Impact, Location, and Maps Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/reviews', reviewRoutes);
router.use('/reports', reportRoutes);
router.use('/items', itemRoutes);
router.use('/saved', savedRoutes);
router.use('/categories', categoryRoutes);
router.use('/wanted', wantedRoutes);
router.use('/requests', requestRoutes);
router.use('/transactions', transactionRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', conversationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/matches', matchRoutes);
router.use('/impact', impactRoutes);
router.use('/points', pointsRoutes);
router.use('/location', locationRoutes);
router.use('/maps', mapRoutes);

// Root /api info
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Looop API',
    data: {
      tagline: 'Share. Reuse. Connect.',
      docs: '/api/health',
      endpoints: {
        items: '/api/items',
        categories: '/api/categories',
        health: '/api/health'
      },
      portals: ['public', 'customer', 'admin'],
      version: '1.0.0'
    }
  });
});

module.exports = router;
