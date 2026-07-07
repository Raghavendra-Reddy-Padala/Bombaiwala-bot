const { db, doc, getDoc } = require('../config/firebase');

// Bombaiwala Chat shop coordinates defaults
const DEFAULT_SHOP_LAT = 17.454082489013672;
const DEFAULT_SHOP_LNG = 78.43592071533203;

/**
 * Calculate distance between two points using Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Calculate delivery fee based on customer location and order subtotal.
 * Loads delivery parameters from Firestore settings/delivery document dynamically.
 * @param {number} customerLat
 * @param {number} customerLng
 * @param {number} orderSubtotal
 * @returns {Promise<{ distanceKm: number, deliveryFee: number, isFree: boolean, outOfRange?: boolean, maxRadius?: number }>}
 */
const calculateDeliveryFee = async (customerLat, customerLng, orderSubtotal = 0) => {
    let settings = {
        freeDeliveryThreshold: 0,
        deliveryFee: 30,
        maxRadius: 2,
        shopLat: DEFAULT_SHOP_LAT,
        shopLng: DEFAULT_SHOP_LNG
    };

    try {
        const docRef = doc(db, 'settings', 'delivery');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            settings = { ...settings, ...docSnap.data() };
        }
    } catch (e) {
        console.error("❌ Failed to load delivery settings from Firestore:", e);
    }

    const distanceKm = haversineDistance(settings.shopLat, settings.shopLng, customerLat, customerLng);
    const roundedDistance = Math.round(distanceKm * 100) / 100; // 2 decimal places

    // Check if customer is outside the maximum allowed delivery radius
    if (roundedDistance > settings.maxRadius) {
        return {
            distanceKm: roundedDistance,
            deliveryFee: settings.deliveryFee,
            isFree: false,
            outOfRange: true,
            maxRadius: settings.maxRadius
        };
    }

    // Check if order subtotal qualifies for free delivery
    if (settings.freeDeliveryThreshold > 0 && orderSubtotal >= settings.freeDeliveryThreshold) {
        return {
            distanceKm: roundedDistance,
            deliveryFee: 0,
            isFree: true,
        };
    }

    // Default to free delivery if distance is very close (e.g. <= 2km as default fallback)
    const FREE_DELIVERY_RADIUS_KM = parseFloat(process.env.FREE_DELIVERY_RADIUS_KM) || 2;
    if (roundedDistance <= FREE_DELIVERY_RADIUS_KM) {
        return {
            distanceKm: roundedDistance,
            deliveryFee: 0,
            isFree: true,
        };
    }

    return {
        distanceKm: roundedDistance,
        deliveryFee: settings.deliveryFee,
        isFree: false,
    };
};

module.exports = { 
    calculateDeliveryFee, 
    haversineDistance, 
    SHOP_LAT: DEFAULT_SHOP_LAT, 
    SHOP_LNG: DEFAULT_SHOP_LNG 
};
