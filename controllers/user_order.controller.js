const { db, doc, getDoc, setDoc, getDocs, collection, query, where, orderBy, serverTimestamp } = require('../config/firebase');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendOwnerAlert, sendOrderConfirmationTemplate } = require('../utils/whatsapp.util');
const { generateOrderId } = require('../utils/order.util');

// Initialize Razorpay Instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID ,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Check if the verified phone number exists in our system.
 */
const checkUserRegistration = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required' });

        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

        const userRef = doc(collection(db, 'customers'), cleanPhone);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            return res.status(200).json({
                success: true,
                registered: true,
                user: userSnap.data()
            });
        } else {
            return res.status(200).json({
                success: true,
                registered: false,
                message: 'New user detected. Profile setup required.'
            });
        }
    } catch (error) {
        console.error('❌ Error checking user registration:', error);
        return res.status(500).json({ success: false, error: 'Server error check context' });
    }
};

/**
 * Completes new user registration by saving Name and Location Coordinates.
 */
const completeProfile = async (req, res) => {
    try {
        const { phone, name, latitude, longitude, address, saveAddress } = req.body;
        if (!phone || !name || !latitude || !longitude || !address) {
            return res.status(400).json({ success: false, error: 'Missing profile parameters' });
        }

        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

        const userRef = doc(collection(db, 'customers'), cleanPhone);
        const userSnap = await getDoc(userRef);

        let savedAddresses = [];
        let existingName = name;
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            savedAddresses = userData.savedAddresses || [];
            if (!name) existingName = userData.name || 'Customer';
        }

        // Add to saved addresses if requested and not duplicate
        const isDuplicate = savedAddresses.some(
            a => a.addressLine.toLowerCase().trim() === address.toLowerCase().trim()
        );
        if (saveAddress && !isDuplicate) {
            savedAddresses.push({
                id: `addr_${Date.now()}`,
                addressLine: address,
                coordinates: {
                    lat: parseFloat(latitude),
                    lng: parseFloat(longitude)
                }
            });
        }

        const profileData = {
            phone: cleanPhone,
            name: existingName,
            address,
            coordinates: {
                lat: parseFloat(latitude),
                lng: parseFloat(longitude)
            },
            savedAddresses,
            updatedAt: new Date().toISOString()
        };

        await setDoc(userRef, profileData, { merge: true });

        return res.status(200).json({ success: true, user: profileData });
    } catch (error) {
        console.error('❌ Profile capture mismatch:', error);
        return res.status(500).json({ success: false, error: 'Failed to complete configuration profile' });
    }
};

/**
 * Initiates order payment pipeline creating a reference receipt inside Razorpay core.
 */
const createRazorpayOrder = async (req, res) => {
    let responseSent = false;
    try {
        const { amount } = req.body; 
        if (!amount) {
            responseSent = true;
            return res.status(400).json({ success: false, error: 'Total amount is required' });
        }

        const options = {
            amount: Math.round(parseFloat(amount) * 100), 
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`
        };

        const response = await razorpay.orders.create(options);
        
        responseSent = true;
        return res.status(200).json({
            success: true,
            orderId: response.id,   
            order_id: response.id,  
            amount: response.amount,
            currency: response.currency,
            // 🟢 Send the correct key ID dynamically to the frontend here:
            key: process.env.RAZORPAY_KEY_ID 
        });

    } catch (error) {
        console.error('❌ Razorpay order initialization failure:', error);
        if (!responseSent) {
            return res.status(500).json({ success: false, error: 'Unable to initiate gateway transaction' });
        }
    }
};

/**
 * Verifies webhook/response signature coming back from Razorpay frontend completion.
 */
const verifyRazorpayPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderDetails // Contains cart items, phone, subtotal, delivery info metrics
        } = req.body;

        // Verify cryptographic signature integrity
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'mockSecretKey54321')
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, error: 'Payment signature validation failed' });
        }

        const orderId = await generateOrderId();
        
        // Structure complete final order context record
        const completeFinalOrder = {
            orderId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            customerName: orderDetails.customerName,
            customerPhone: orderDetails.customerPhone,
            items: orderDetails.cart,
            subtotal: orderDetails.subtotal,
            deliveryFee: orderDetails.deliveryFee,
            totalAmount: orderDetails.totalAmount,
            deliveryType: orderDetails.deliveryFee === 0 ? 'free' : 'rapido',
            location: orderDetails.location, // Contains coordinate mapping pairs
            status: 'paid', // Order verified and paid successfully
            paymentStatus: 'success',
            createdAt: new Date().toISOString()
        };

        // Write order payload straight to top level production collection
        const orderRef = doc(collection(db, 'orders'), orderId);
        await setDoc(orderRef, completeFinalOrder);

        // Dispatches WhatsApp notifications instantly asynchronously
        try {
            await sendOrderConfirmationTemplate(
                orderDetails.customerPhone,
                orderDetails.customerName,
                orderId,
                orderDetails.totalAmount
            );
            await sendOwnerAlert(completeFinalOrder);
        } catch (waErr) {
            console.warn('⚠️ Dispatched hooks structural logging mismatch:', waErr.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Transaction verified and contextual logs created.',
            orderId
        });
    } catch (error) {
        console.error('❌ Verification handler failure state:', error);
        return res.status(500).json({ success: false, error: 'Internal runtime record generation exception' });
    }
};

/**
 * Returns past structural metrics for display inside a customer profile screen.
 */
const getCustomerOrders = async (req, res) => {
    try {
        const { phone } = req.params;
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

        const ordersRef = collection(db, 'orders');
        const q = query(
            ordersRef,
            where('customerPhone', '==', cleanPhone)
        );

        const snapshot = await getDocs(q);
        const ordersList = [];
        
        snapshot.forEach(doc => {
            ordersList.push(doc.data());
        });

        // Sort in memory by createdAt desc to avoid requiring composite indexes
        ordersList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        return res.status(200).json({
            success: true,
            orders: ordersList
        });
    } catch (error) {
        console.error('❌ Failed fetching order ledger history:', error);
        return res.status(500).json({ success: false, error: 'Failed fetching profile metrics historical index' });
    }
};

module.exports = {
    checkUserRegistration,
    completeProfile,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getCustomerOrders
};