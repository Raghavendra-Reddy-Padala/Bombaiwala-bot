/**
 * OTP Service — Generate, save, and verify OTPs using Firebase.
 * OTPs are stored in the `otp_sessions` collection with a 10-minute TTL.
 */

const { db, doc, getDoc, setDoc, deleteDoc, collection } = require('../config/firebase');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a random 6-digit OTP code.
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Save an OTP to Firebase for a given phone number.
 * Overwrites any existing OTP for that phone.
 *
 * @param {string} phone - WhatsApp phone number (e.g. "919032323095")
 * @param {string} otp   - The 6-digit OTP code
 * @returns {object}     - The saved OTP session data
 */
const saveOTP = async (phone, otp) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

    const otpData = {
        phone: cleanPhone,
        otp,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        expiresAtMs: expiresAt.getTime(),
        verified: false,
        attempts: 0,
    };

    const otpRef = doc(collection(db, 'otp_sessions'), cleanPhone);
    await setDoc(otpRef, otpData);

    console.log(`🔐 OTP saved for ${cleanPhone} — expires at ${expiresAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    return otpData;
};

/**
 * Verify an OTP for a given phone number.
 *
 * @param {string} phone    - WhatsApp phone number
 * @param {string} inputOtp - The OTP the user entered
 * @returns {object}        - { success: boolean, message: string }
 */
const verifyOTP = async (phone, inputOtp) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const otpRef = doc(collection(db, 'otp_sessions'), cleanPhone);
    const otpSnap = await getDoc(otpRef);

    if (!otpSnap.exists()) {
        return { success: false, message: 'No OTP found. Please request a new one.' };
    }

    const otpData = otpSnap.data();

    // Check expiry
    const now = Date.now();
    if (now > otpData.expiresAtMs) {
        await deleteDoc(otpRef);
        return { success: false, message: 'OTP expired. Please request a new one.' };
    }

    // Check max attempts (prevent brute force — max 5 tries)
    if (otpData.attempts >= 5) {
        await deleteDoc(otpRef);
        return { success: false, message: 'Too many attempts. Please request a new OTP.' };
    }

    // Increment attempt count
    await setDoc(otpRef, { ...otpData, attempts: otpData.attempts + 1 });

    // Check OTP match
    if (otpData.otp !== inputOtp) {
        return {
            success: false,
            message: `Incorrect OTP. ${4 - otpData.attempts} attempts remaining.`,
        };
    }

    // OTP matched — mark as verified and clean up
    await setDoc(otpRef, { ...otpData, verified: true, verifiedAt: new Date().toISOString() });

    console.log(`✅ OTP verified for ${cleanPhone}`);
    return { success: true, message: 'OTP verified successfully!' };
};

/**
 * Delete an OTP session (cleanup after verification or manual reset).
 */
const deleteOTPSession = async (phone) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const otpRef = doc(collection(db, 'otp_sessions'), cleanPhone);
    await deleteDoc(otpRef);
    console.log(`🗑️ OTP session deleted for ${cleanPhone}`);
};

module.exports = {
    generateOTP,
    saveOTP,
    verifyOTP,
    deleteOTPSession,
};
