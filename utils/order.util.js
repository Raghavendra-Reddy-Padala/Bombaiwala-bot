const { db, collection, getDocs, query, where } = require('../config/firebase');

/**
 * Generates a sequential order ID in the format of YYYYMMDD-X.
 * Where X is the sequence count of orders created today plus 1.
 * Falls back to a timestamp base if query fails.
 */
const generateOrderId = async () => {
    try {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setUTCHours(0, 0, 0, 0);
        const startIso = startOfToday.toISOString();

        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('createdAt', '>=', startIso));
        const snap = await getDocs(q);
        const count = snap.size;
        const nextSeq = count + 1;

        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}${month}${year}`; // "07072026"
        return `${dateStr}-${nextSeq}`;
    } catch (e) {
        console.error("❌ Failed to generate sequential order ID, falling back to timestamp:", e);
        return `BW-${Date.now()}`;
    }
};

module.exports = { generateOrderId };
