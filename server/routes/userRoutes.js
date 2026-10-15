const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth, optionalAuth } = require('../middleware/auth');
const uploadMiddleware = require('../middleware/uploadMiddleware');

// Protected current user profile endpoints
router.get('/me', auth, userController.getMe);
router.patch('/me', auth, userController.updateMe);
router.post('/me/avatar', auth, uploadMiddleware.single('avatar'), userController.uploadAvatar);

// Public / community user profile endpoint
router.get('/:id', optionalAuth, userController.getPublicProfile);

module.exports = router;
