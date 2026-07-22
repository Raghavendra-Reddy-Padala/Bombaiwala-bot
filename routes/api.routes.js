const express = require('express');
const {
    handleWebOrder,
    handleSendTracking,
    handleSendOTP,
    handleVerifyOTP,
} = require('../controllers/api.controller');

const {
    checkUserRegistration,
    completeProfile,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getCustomerOrders
} = require('../controllers/user_order.controller');

// Import your raw menu data module
const { db, collection, getDocs, doc, getDoc } = require('../config/firebase');

const router = express.Router();

router.get('/settings/delivery', async (req, res) => {
    try {
        const docRef = doc(db, 'settings', 'delivery');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return res.status(200).json({ success: true, settings: docSnap.data() });
        }
        // Fallback default settings
        return res.status(200).json({
            success: true,
            settings: {
                freeDeliveryThreshold: 0,
                deliveryFee: 30,
                maxRadius: 2,
                shopLat: 17.454082489013672,
                shopLng: 78.43592071533203
            }
        });
    } catch (error) {
        console.error("❌ Failed to fetch delivery settings:", error);
        res.status(500).json({ success: false, error: "Failed to fetch settings" });
    }
});

router.get('/categories', async (req, res) => {
    try {
        const snapshot = await getDocs(collection(db, 'categories'));
        const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, categories });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch categories" });
    }
});

// Route to get all products
router.get('/products', async (req, res) => {
    try {
        const snapshot = await getDocs(collection(db, 'products'));
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch products" });
    }
});

// Route to get all combos
router.get('/combos', async (req, res) => {
    try {
        const snapshot = await getDocs(collection(db, 'combos'));
        const combos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json({ success: true, combos });
    } catch (error) {
        console.error("❌ Failed to fetch combos:", error);
        res.status(500).json({ success: false, error: "Failed to fetch combos" });
    }
});

router.get('/menu', async (req, res) => {
    try {
        // Change 'products' to your actual Firestore collection name if it is different
        const productsRef = collection(db, 'products'); 
        const snapshot = await getDocs(productsRef);
        
        const items = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            items.push({
                id: doc.id,
                ...data,
                // Ensure field fallbacks match your Firestore document key names
                name: data.name || 'Unnamed Item',
                sellingPrice: data.sellingPrice || data.price || 0,
                mrp: data.mrp || data.price || 0,
                brand: data.brand ? data.brand.toLowerCase() : 'chaat',
                description: data.description || '',
                isVeg: data.isVeg !== undefined ? data.isVeg : true,
                inStock: data.inStock !== undefined ? data.inStock : true,
                images: data.images || []
            });
        });

        // Send a flat array of normalized items to the frontend
        return res.status(200).json({ 
            success: true, 
            menu: items 
        });
    } catch (error) {
        console.error("❌ Firestore menu fetch failed:", error);
        return res.status(500).json({ success: false, error: "Failed loading live database items" });
    }
});

// Web Orders & Management
router.post('/orders', handleWebOrder);
router.post('/tracking', handleSendTracking);
router.post('/otp/send', handleSendOTP);
router.post('/otp/verify', handleVerifyOTP);

// User & Payment Management
router.post('/user/check', checkUserRegistration);
router.post('/user/complete-profile', completeProfile);
router.post('/payment/create', createRazorpayOrder);
router.post('/payment/verify', verifyRazorpayPayment);
router.get('/customer/:phone/orders', getCustomerOrders);

module.exports = router;