const express = require('express');
const {
    handleWebOrder,
    handleSendTracking,
    handleSendOTP,
    handleVerifyOTP,
} = require('../controllers/api.controller');

const router = express.Router();

// Endpoint for the website to submit orders
router.post('/orders', handleWebOrder);

// Endpoint for admin dashboard to send tracking link to customer
router.post('/tracking', handleSendTracking);

// OTP endpoints for phone verification
router.post('/otp/send', handleSendOTP);
router.post('/otp/verify', handleVerifyOTP);

module.exports = router;
