const express = require('express');
const router = express.Router();
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');
const impactController = require('../controllers/impactController');

const contentController = require('../controllers/contentController');

// All administrative routes require strict verified administrative privileges
router.use(adminMiddleware);

// 1. Dashboard & Platform Overview
router.get('/dashboard', adminController.getDashboard);

// 2. Real Aggregated Analytics
router.get('/analytics', adminController.getAnalytics);

// 3. User Governance
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);

// 4. Listing Moderation
router.get('/items', adminController.getItems);
router.get('/items/:id', adminController.getItemDetails);
router.delete('/items/:id', adminController.deleteItem);
router.patch('/items/:id/moderation', adminController.moderateItem);
router.patch('/items/:id/approve', adminController.approveItem);
router.post('/items/:id/approve', adminController.approveItem);
router.patch('/items/:id/reject', adminController.rejectItem);
router.post('/items/:id/reject', adminController.rejectItem);
router.post('/items/:id/award-coins', adminController.awardItemCoins);

// 5. Wanted Items Oversight
router.get('/wanted', adminController.getWantedItems);

// 6. Requests Monitoring
router.get('/requests', adminController.getRequests);
router.get('/requests/:id', adminController.getRequestDetails);

// 7. Transactions Oversight
router.get('/transactions', adminController.getTransactions);
router.get('/transactions/:id', adminController.getTransactionDetails);
router.patch('/transactions/:id/complete', adminController.adminCompleteTransaction);

// 8. Reports & Dispute Moderation
router.get('/reports', adminController.getReports);
router.get('/reports/:id', adminController.getReportDetails);
router.patch('/reports/:id/resolve', adminController.resolveReport);

// 9. Categories Management
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.patch('/categories/:id', adminController.updateCategory);
router.patch('/categories/:id/status', adminController.toggleCategoryStatus);

// 10. Platform Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);
router.get('/upload-rules', adminController.getUploadRules);
router.put('/upload-rules', adminController.updateUploadRules);
router.get('/location-rules', adminController.getLocationRules);
router.put('/location-rules', adminController.updateLocationRules);
router.get('/points-settings', adminController.getPointsSettings);
router.put('/points-settings', adminController.updatePointsSettings);

// 11. Security Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

// 12. Environmental Impact & Factors Governance
router.get('/impact/summary', impactController.getAdminImpactSummary);
router.get('/impact/trends', impactController.getAdminImpactTrends);
router.get('/impact/factors', impactController.getImpactFactors);
router.post('/impact/factors', impactController.createImpactFactor);
router.patch('/impact/factors/:id', impactController.updateImpactFactor);
router.delete('/impact/factors/:id', impactController.deleteImpactFactor);
router.post('/impact/recalculate/:transactionId', impactController.recalculateTransactionImpact);

// 13. Transactional Email System Diagnostics & Test
router.get('/email/diagnostics', adminController.getEmailDiagnostics);
router.post('/email/test', adminController.sendTestEmail);
router.post('/email/outbox/process', adminController.processEmailOutboxQueue);

// 14. Site CMS & Branding Settings (Header nav, Logo, Site name, Impact section stats)
router.get('/site-settings', contentController.getSiteSettings);
router.put('/site-settings', contentController.updateSiteSettings);

// 15. Review Management (Create, Publish/Unpublish, Edit, Delete permanently)
router.get('/site-reviews', contentController.getAdminReviews);
router.post('/site-reviews', contentController.createReview);
router.put('/site-reviews/:id', contentController.updateReview);
router.patch('/site-reviews/:id/publish', contentController.toggleReviewPublish);
router.delete('/site-reviews/:id', contentController.deleteReview);

// 16. Broadcast Announcements (Send updates to verified subscribers & registered customers)
router.get('/broadcasts', contentController.getBroadcasts);
router.post('/broadcasts', contentController.sendBroadcast);
router.get('/subscribers', contentController.getSubscribers);

// 17. Rewards Store Management & Master Switch
const rewardStoreController = require('../controllers/rewardStoreController');
router.get('/rewards/settings', rewardStoreController.getStoreSettings);
router.put('/rewards/settings', rewardStoreController.updateStoreSettings);
router.get('/rewards', rewardStoreController.adminGetRewards);
router.post('/rewards', rewardStoreController.adminCreateReward);
router.put('/rewards/:id', rewardStoreController.adminUpdateReward);
router.delete('/rewards/:id', rewardStoreController.adminDeleteReward);

// 18. Rewards Store Orders & Delivery Fulfillment
router.get('/reward-orders', rewardStoreController.adminGetOrders);
router.get('/reward-orders/:id', rewardStoreController.adminGetOrderDetail);
router.patch('/reward-orders/:id/status', rewardStoreController.adminUpdateOrderStatus);
router.post('/reward-orders/:id/refund', rewardStoreController.adminCancelAndRefundOrder);

module.exports = router;

