const { sendOrderConfirmation, sendOwnerAlert } = require('../utils/whatsapp.util');

const handleWebOrder = async (req, res) => {
    try {
        const orderData = req.body;
        
        console.log(`\n🌐 ── NEW WEB ORDER RECEIVED ──`);
        console.log(`   Order ID: ${orderData.orderId}`);
        console.log(`   Customer: ${orderData.customerName} (${orderData.customerPhone})`);
        
        // 1. Send confirmation to the customer's WhatsApp
        // We assume customerPhone includes the country code. The frontend should ideally enforce this or we append 91 if it's 10 digits.
        let phone = orderData.customerPhone.replace(/[^0-9]/g, '');
        if (phone.length === 10) {
            phone = '91' + phone; // Default to India country code
        }
        
        await sendOrderConfirmation(
            phone,
            orderData.orderId,
            orderData.totalAmount,
            orderData.deliveryType === 'free'
        );

        // 2. Send the owner alert via WhatsApp template message
        await sendOwnerAlert(orderData);

        return res.status(200).json({ success: true, message: 'Order processed and WhatsApp messages sent.' });
    } catch (error) {
        console.error('❌ Failed to process web order:', error);
        return res.status(500).json({ success: false, error: 'Failed to process web order' });
    }
};

module.exports = {
    handleWebOrder
};
