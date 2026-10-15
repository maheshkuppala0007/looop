const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');

// Public site settings (Branding, navigation links, impact section titles)
router.get('/settings', contentController.getSiteSettings);

// Public published reviews (Top 3 website-appreciating testimonials)
router.get('/reviews', contentController.getPublicReviews);

// Live real impact statistics (strictly starts at 0 and increments with platform reuse actions)
router.get('/impact-stats', contentController.getLiveImpactStats);

// Newsletter subscription with duplicate check & OTP email dispatch via Brevo
router.post('/subscribe', contentController.subscribeNewsletter);

// Newsletter OTP verification to confirm subscriber in PostgreSQL
router.post('/verify-otp', contentController.verifySubscriberOtp);

module.exports = router;
