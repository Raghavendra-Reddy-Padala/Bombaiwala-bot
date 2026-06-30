/**
 * Distance calculation utility using the Haversine formula.
 * Used to determine if a customer is within free delivery radius.
 */

// Bombaiwala Chat shop coordinates
const SHOP_LAT = parseFloat(process.env.SHOP_LAT) || 17.454082489013672;
const SHOP_LNG = parseFloat(process.env.SHOP_LNG) || 78.43592071533203;
const FREE_DELIVERY_RADIUS_KM = parseFloat(process.env.FREE_DELIVERY_RADIUS_KM) || 2;
const RAPIDO_FLAT_CHARGE = parseFloat(process.env.RAPIDO_FLAT_CHARGE) || 30;

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
 * Calculate delivery fee based on customer location.
 * @param {number} customerLat
 * @param {number} customerLng
 * @returns {{ distanceKm: number, deliveryFee: number, isFree: boolean }}
 */
const calculateDeliveryFee = (customerLat, customerLng) => {
    const distanceKm = haversineDistance(SHOP_LAT, SHOP_LNG, customerLat, customerLng);
    const roundedDistance = Math.round(distanceKm * 100) / 100; // 2 decimal places

    if (roundedDistance <= FREE_DELIVERY_RADIUS_KM) {
        return {
            distanceKm: roundedDistance,
            deliveryFee: 0,
            isFree: true,
        };
    }

    return {
        distanceKm: roundedDistance,
        deliveryFee: RAPIDO_FLAT_CHARGE,
        isFree: false,
    };
};

module.exports = { calculateDeliveryFee, haversineDistance, SHOP_LAT, SHOP_LNG };
