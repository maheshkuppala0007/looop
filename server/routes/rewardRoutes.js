const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rewardStoreController = require('../controllers/rewardStoreController');

// Public Store Setting Check
router.get('/settings', rewardStoreController.getStoreSettings);

// Public Rewards Catalog (enforces store master switch)
router.get('/', rewardStoreController.getRewardProducts);
router.get('/:id', rewardStoreController.getRewardProductById);

// Protected Customer Redemption & Tracking Endpoints
router.post('/orders', auth, rewardStoreController.createRedemptionOrder);
router.get('/orders/my', auth, rewardStoreController.getMyOrders);
router.get('/orders/:id', auth, rewardStoreController.getOrderDetails);
router.post('/orders/:id/cancel', auth, rewardStoreController.cancelCustomerOrder);

module.exports = router;
