/**
 * API Controller — Handles web orders, tracking links, and OTP operations.
 * Called by the frontend website and admin dashboard.
 */

const {
    sendOrderConfirmation,
    sendOrderConfirmationTemplate,
    sendOwnerAlert,
    sendTrackingUpdate,
    sendOTP,
} = require('../utils/whatsapp.util');
const { generateOTP, saveOTP, verifyOTP } = require('../utils/otp.service');

// ─────────────────────────────────────────────
// WEB ORDER — process order from website
// ─────────────────────────────────────────────
const handleWebOrder = async (req, res) => {
    try {
        const orderData = req.body;

        console.log(`\n🌐 ── NEW WEB ORDER RECEIVED ──`);
        console.log(`   Order ID: ${orderData.orderId}`);
        console.log(`   Customer: ${orderData.customerName} (${orderData.customerPhone})`);

        // Normalize phone — strip non-digits, add 91 if 10 digits
        let phone = orderData.customerPhone.replace(/[^0-9]/g, '');
        if (phone.length === 10) {
            phone = '91' + phone;
        }

        // 1. Send confirmation to the customer's WhatsApp (template with name, fallback to plain text)
        try {
            await sendOrderConfirmationTemplate(
                phone,
                orderData.customerName || 'Customer',
                orderData.orderId,
                orderData.totalAmount
            );
        } catch (e) {
            console.warn('⚠️ Template failed, falling back to plain text confirmation');
            await sendOrderConfirmation(
                phone,
                orderData.orderId,
                orderData.totalAmount,
                orderData.deliveryType === 'free'
            );
        }

        // 2. Send the owner alert via WhatsApp template message
        await sendOwnerAlert(orderData);

        return res.status(200).json({ success: true, message: 'Order processed and WhatsApp messages sent.' });
    } catch (error) {
        console.error('❌ Failed to process web order:', error);
        return res.status(500).json({ success: false, error: 'Failed to process web order' });
    }
};

// ─────────────────────────────────────────────
// SEND TRACKING — admin sends tracking link to customer
// ─────────────────────────────────────────────
const handleSendTracking = async (req, res) => {
    try {
        const { orderId, customerPhone, customerName, trackingLink } = req.body;

        if (!orderId || !customerPhone || !trackingLink) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: orderId, customerPhone, trackingLink',
            });
        }

        // Normalize phone
        let phone = customerPhone.replace(/[^0-9]/g, '');
        if (phone.length === 10) {
            phone = '91' + phone;
        }

        const name = customerName || 'Customer';

        console.log(`\n📦 ── SENDING TRACKING LINK ──`);
        console.log(`   Order: ${orderId}`);
        console.log(`   To: ${phone} (${name})`);
        console.log(`   Link: ${trackingLink}`);

        await sendTrackingUpdate(phone, name, orderId, trackingLink);

        return res.status(200).json({
            success: true,
            message: `Tracking link sent to ${phone} for order ${orderId}`,
        });
    } catch (error) {
        console.error('❌ Failed to send tracking:', error);
        return res.status(500).json({ success: false, error: 'Failed to send tracking link' });
    }
};

// ─────────────────────────────────────────────
// SEND OTP — generate + save to Firebase + send via WhatsApp
// ─────────────────────────────────────────────
const handleSendOTP = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        // Normalize phone
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) {
            cleanPhone = '91' + cleanPhone;
        }

        console.log(`\n🔐 ── OTP REQUEST ──`);
        console.log(`   Phone: ${cleanPhone}`);

        // 1. Generate OTP
        const otp = generateOTP();

        // 2. Save to Firebase (otp_sessions collection)
        await saveOTP(cleanPhone, otp);

        // 3. Send via WhatsApp template
        const result = await sendOTP(cleanPhone, otp);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: `OTP sent to ${cleanPhone}`,
                // DO NOT send the OTP back in production! This is for debugging only.
                // otp: otp,
            });
        } else {
            return res.status(500).json({
                success: false,
                error: 'Failed to send OTP via WhatsApp',
                details: result.error,
            });
        }
    } catch (error) {
        console.error('❌ Failed to send OTP:', error);
        return res.status(500).json({ success: false, error: 'Failed to send OTP' });
    }
};

// ─────────────────────────────────────────────
// VERIFY OTP — check against Firebase
// ─────────────────────────────────────────────
const handleVerifyOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Phone number and OTP are required',
            });
        }

        // Normalize phone
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) {
            cleanPhone = '91' + cleanPhone;
        }

        console.log(`\n🔑 ── OTP VERIFY ──`);
        console.log(`   Phone: ${cleanPhone}`);
        console.log(`   OTP entered: ${otp}`);

        const result = await verifyOTP(cleanPhone, otp);

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: result.message,
                verified: true,
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message,
                verified: false,
            });
        }
    } catch (error) {
        console.error('❌ Failed to verify OTP:', error);
        return res.status(500).json({ success: false, error: 'Failed to verify OTP' });
    }
};

module.exports = {
    handleWebOrder,
    handleSendTracking,
    handleSendOTP,
    handleVerifyOTP,
};
