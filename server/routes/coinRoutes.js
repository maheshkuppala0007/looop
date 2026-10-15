const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const coinController = require('../controllers/coinController');

router.use(auth);

// GET /api/coins/balance - Available coin balance
router.get('/balance', coinController.getBalance);

// GET /api/coins/ledger - Auditable coin transaction ledger
router.get('/ledger', coinController.getLedger);

// GET /api/coins - Full customer coins dashboard
router.get('/', coinController.getCoinDashboard);

module.exports = router;
