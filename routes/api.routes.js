const express = require('express');
const { handleWebOrder } = require('../controllers/api.controller');

const router = express.Router();

// Endpoint for the website to submit orders
router.post('/orders', handleWebOrder);

module.exports = router;
