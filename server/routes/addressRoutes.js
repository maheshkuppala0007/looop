const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const addressController = require('../controllers/addressController');

router.use(auth);

router.get('/', addressController.getMyAddresses);
router.post('/', addressController.createAddress);
router.delete('/:id', addressController.deleteAddress);

module.exports = router;
