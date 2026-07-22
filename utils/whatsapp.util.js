/**
 * WhatsApp Cloud API messaging utilities for Bombaiwala Chat bot.
 * Handles all outgoing messages: text, images, interactive lists, buttons,
 * template messages, and media uploads.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const WA_API = `https://graph.facebook.com/v25.0/${process.env.META_PHONE_ID}/messages`;
const WA_MEDIA_API = `https://graph.facebook.com/v25.0/${process.env.META_PHONE_ID}/media`;
const HEADERS = { Authorization: `Bearer ${process.env.META_TOKEN}` };

// Cached menu image media ID (uploaded on startup)
let menuMediaId = null;

// ─────────────────────────────────────────────
// UPLOAD MENU IMAGE — called once on server start
// ─────────────────────────────────────────────
const uploadMenuImage = async () => {
    try {
        const imagePath = path.join(__dirname, '..', 'menu.jpeg');
        if (!fs.existsSync(imagePath)) {
            console.warn('⚠️ menu.jpeg not found — skipping media upload');
            return null;
        }

        const form = new FormData();
        form.append('file', fs.createReadStream(imagePath));
        form.append('messaging_product', 'whatsapp');
        form.append('type', 'image/jpeg');

        const response = await axios.post(WA_MEDIA_API, form, {
            headers: {
                ...HEADERS,
                ...form.getHeaders(),
            },
        });

        menuMediaId = response.data.id;
        console.log(`✅ Menu image uploaded — media ID: ${menuMediaId}`);
        return menuMediaId;

    } catch (e) {
        console.error('❌ uploadMenuImage failed:', e.response?.data || e.message);
        return null;
    }
};

// ─────────────────────────────────────────────
// SEND PLAIN TEXT
// ─────────────────────────────────────────────
const sendReply = async (to, text) => {
    try {
        await axios.post(WA_API, {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
        }, { headers: HEADERS });
    } catch (e) {
        console.error('❌ sendReply failed:', e.response?.data || e.message);
    }
};

// ─────────────────────────────────────────────
// SEND IMAGE (by media ID or URL)
// ─────────────────────────────────────────────
const sendImage = async (to, { mediaId, imageUrl, caption = '' }) => {
    try {
        const imagePayload = {};
        if (mediaId) {
            imagePayload.id = mediaId;
        } else if (imageUrl) {
            imagePayload.link = imageUrl;
        }
        if (caption) imagePayload.caption = caption;

        await axios.post(WA_API, {
            messaging_product: 'whatsapp',
            to,
            type: 'image',
            image: imagePayload,
        }, { headers: HEADERS });
    } catch (e) {
        console.error('❌ sendImage failed:', e.response?.data || e.message);
    }
};

// ─────────────────────────────────────────────
// SEND TEMPLATE MESSAGE — for owner order alerts
// ─────────────────────────────────────────────
const sendTemplate = async (to, templateName, languageCode, bodyParams = []) => {
    try {
        const components = [];
        if (bodyParams.length > 0) {
            components.push({
                type: 'body',
                parameters: bodyParams.map(val => ({
                    type: 'text',
                    text: String(val),
                })),
            });
        }

        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode },
                components,
            },
        };

        console.log(`\n📤 ── SENDING TEMPLATE ──`);
        console.log(`   To: ${to}`);
        console.log(`   Template: ${templateName}`);
        console.log(`   Language: ${languageCode}`);
        console.log(`   Params: ${JSON.stringify(bodyParams)}`);
        console.log(`   Full payload: ${JSON.stringify(payload, null, 2)}`);

        const response = await axios.post(WA_API, payload, { headers: HEADERS });

        console.log(`✅ Template "${templateName}" sent to ${to}`);
        console.log(`   Response: ${JSON.stringify(response.data)}`);
    } catch (e) {
        console.error('❌ sendTemplate failed:');
        console.error('   Status:', e.response?.status);
        console.error('   Error data:', JSON.stringify(e.response?.data, null, 2));
        console.error('   Message:', e.message);
    }
};

// ─────────────────────────────────────────────
// WELCOME MESSAGE — simple greeting + website link
// ─────────────────────────────────────────────
const sendWelcome = async (to) => {
    try {
        await sendReply(to,
            '*Hey there! Welcome to Bombaiwala* 🙏\n\n' +
            'Hyderabad\'s favourite street food!\n\n' +
            '🌐 Order from our website: *bombaiwala.com*'
        );
    } catch (e) {
        console.error('❌ sendWelcome failed:', e.response?.data || e.message);
    }
};

// ─────────────────────────────────────────────
// CART SUMMARY — show parsed cart + Modify/Checkout buttons
// ─────────────────────────────────────────────
const sendCartSummary = async (to, cart, unmatchedItems) => {
    const cartSummary = cart
        .map((item, i) => `  ${i + 1}. ${item.name} × ${item.qty} = ₹${item.price * item.qty}`)
        .join('\n');

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    let unmatchedText = '';
    if (unmatchedItems && unmatchedItems.length > 0) {
        unmatchedText = `\n\n⚠️ _Couldn't find: ${unmatchedItems.join(', ')}_`;
    }

    try {
        await axios.post(WA_API, {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text:
                        `🛒 *Your Order:*\n\n${cartSummary}\n\n` +
                        `💰 Subtotal: *₹${subtotal}*${unmatchedText}\n\n` +
                        `Looks good? Tap *Checkout* to proceed or *Modify* to reorder.`,
                },
                action: {
                    buttons: [
                        { type: 'reply', reply: { id: 'btn_checkout', title: '✅ Checkout' } },
                        { type: 'reply', reply: { id: 'btn_modify_order', title: '✏️ Modify Order' } },
                    ],
                },
            },
        }, { headers: HEADERS });
    } catch (e) {
        console.error('❌ sendCartSummary failed:', e.response?.data || e.message);
    }
};

// ─────────────────────────────────────────────
// REQUEST CUSTOMER NAME
// ─────────────────────────────────────────────
const sendNameRequest = async (to) => {
    await sendReply(
        to,
        '👤 Please share your *name* for the order:'
    );
};

// ─────────────────────────────────────────────
// REQUEST LOCATION — ask user to share live location
// ─────────────────────────────────────────────
const sendLocationRequest = async (to) => {
    await sendReply(
        to,
        '📍 *Share your delivery location*\n\n' +
        'Please send your location using WhatsApp\'s location sharing:\n\n' +
        '1. Tap the 📎 (attach) icon\n' +
        '2. Select 📍 Location\n' +
        '3. Send your current or delivery location\n\n' +
        '_This helps us calculate delivery charges._'
    );
};

// ─────────────────────────────────────────────
// ORDER SUMMARY (before confirmation)
// ─────────────────────────────────────────────
const sendOrderSummary = async (to, cart, customerName, deliveryInfo) => {
    const cartLines = cart
        .map((item, i) => `  ${i + 1}. ${item.name} × ${item.qty} = ₹${item.price * item.qty}`)
        .join('\n');

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const total = subtotal + deliveryInfo.deliveryFee;

    const deliveryText = deliveryInfo.isFree
        ? '🟢 *FREE Delivery* (within 2 km)'
        : `🔴 Delivery: *₹${deliveryInfo.deliveryFee}* (Rapido — ${deliveryInfo.distanceKm} km away)`;

    try {
        await axios.post(WA_API, {
            messaging_product: 'whatsapp',
            to,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: {
                    text:
                        `📦 *Order Summary*\n\n` +
                        `👤 Name: ${customerName}\n\n` +
                        `🛒 *Items:*\n${cartLines}\n\n` +
                        `💰 Subtotal: ₹${subtotal}\n` +
                        `${deliveryText}\n` +
                        `━━━━━━━━━━━━━━━━\n` +
                        `🏷️ *Total: ₹${total}*\n\n` +
                        `Tap *Confirm* to place your order!`,
                },
                action: {
                    buttons: [
                        { type: 'reply', reply: { id: 'btn_confirm_order', title: '✅ Confirm Order' } },
                        { type: 'reply', reply: { id: 'btn_cancel_order', title: '❌ Cancel' } },
                    ],
                },
            },
        }, { headers: HEADERS });
    } catch (e) {
        console.error('❌ sendOrderSummary failed:', e.response?.data || e.message);
    }
};

// ─────────────────────────────────────────────
// ORDER CONFIRMATION — send template to customer
// ─────────────────────────────────────────────
const sendOrderConfirmation = async (to, orderId, total, isFreeDelivery) => {
    const templateName = process.env.TEMPLATE_ORDER_CONFIRMATION || 'order_confirmation';
    const customerName = 'Customer'; // Will be overridden by the overload below

    // Try sending template first (works outside 24-hour window)
    try {
        await sendTemplate(to, templateName, 'en', [customerName, orderId, String(total)]);
        console.log(`✅ Order confirmation template sent to ${to}`);
    } catch (e) {
        // Fallback to plain text (only works within 24-hour window)
        console.warn(`⚠️ Template failed, falling back to plain text for ${to}`);
        const deliveryMsg = isFreeDelivery
            ? '🟢 Delivery: *FREE* (you\'re within 2 km!)'
            : '🔴 Delivery charge will be collected via Rapido.';

        await sendReply(
            to,
            `🎉 *Order Placed Successfully!*\n\n` +
            `🔖 Order ID: *${orderId}*\n` +
            `💰 Total: *₹${total}*\n` +
            `${deliveryMsg}\n\n` +
            `⏰ Your order is being prepared! We'll have it ready soon.\n\n` +
            `Thank you for choosing *Bombaiwala Chat*! 🙏\n\n` +
            `Type *hi* to order again.`
        );
    }
};

// ─────────────────────────────────────────────
// ORDER CONFIRMATION (with customer name) — template version
// ─────────────────────────────────────────────
const sendOrderConfirmationTemplate = async (to, customerName, orderId, totalAmount) => {
    const templateName = process.env.TEMPLATE_ORDER_CONFIRMATION || 'order_confirmation';
    await sendTemplate(to, templateName, 'en', [customerName, orderId, String(totalAmount)]);
};

// ─────────────────────────────────────────────
// OWNER ALERT — notify owner using template message
// ─────────────────────────────────────────────
const sendOwnerAlert = async (orderData) => {
    const ownerPhone = process.env.OWNER_PHONE;
    console.log(`\n🔔 ── OWNER ALERT ──`);
    console.log(`   OWNER_PHONE from .env: "${ownerPhone}"`);

    if (!ownerPhone) {
        console.warn('⚠️ OWNER_PHONE not set in .env — skipping owner alert');
        return;
    }

    // Build items summary string for template
    const itemsSummary = orderData.items
        .map(item => `${item.qty}x ${item.name}`)
        .join(', ');

    const templateName = process.env.TEMPLATE_ORDER_RECEIVED || 'order_received';

    // Build location link
    const locationLink = orderData.location
        ? `https://maps.google.com/?q=${orderData.location.lat},${orderData.location.lng}`
        : 'Not shared';

    // Try template first (works outside 24-hour window)
    try {
        await sendTemplate(ownerPhone, templateName, 'en', [
            orderData.orderId,
            orderData.customerName,
            itemsSummary,
            String(orderData.totalAmount),
            locationLink,
            String(orderData.customerPhone || ''),
            orderData.address || 'Not shared',
        ]);
        console.log(`✅ Owner alert template sent for order ${orderData.orderId}`);
    } catch (e) {
        // Fallback to plain text (only works within 24-hour window)
        console.warn(`⚠️ Template failed, falling back to plain text for owner`);
        const deliveryText = orderData.deliveryType === 'free'
            ? 'FREE'
            : `₹${orderData.deliveryFee} Rapido`;

        const orderSummaryMsg = `🔔 *NEW ORDER RECEIVED!*\n\n` +
            `🔖 Order ID: *${orderData.orderId}*\n` +
            `👤 Customer: ${orderData.customerName}\n` +
            `📞 Phone: +${orderData.customerPhone}\n\n` +
            `🛒 *Items:*\n${orderData.items.map((item, i) => `  ${i + 1}. ${item.name} × ${item.qty} = ₹${item.total}`).join('\n')}\n\n` +
            `💰 Subtotal: ₹${orderData.subtotal}\n` +
            `🚚 Delivery: ${deliveryText}\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `🏷️ *Total: ₹${orderData.totalAmount}*\n\n` +
            `📍 Location: ${orderData.location ? `https://maps.google.com/?q=${orderData.location.lat},${orderData.location.lng}` : 'Not shared'}\n\n` +
            `⏰ ${new Date(orderData.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

        await sendReply(ownerPhone, orderSummaryMsg);
    }

    console.log(`📢 Owner alert completed for order ${orderData.orderId}`);
};

// ─────────────────────────────────────────────
// ORDER RECEIVED TEMPLATE — send to owner (standalone)
// ─────────────────────────────────────────────
const sendOrderReceivedTemplate = async (to, orderId, customerName, itemsSummary, totalAmount, locationLink, customerPhone, address) => {
    const templateName = process.env.TEMPLATE_ORDER_RECEIVED || 'order_received';
    await sendTemplate(to, templateName, 'en', [orderId, customerName, itemsSummary, String(totalAmount), locationLink || 'Not shared', String(customerPhone || ''), address || 'Not shared']);
};

// ─────────────────────────────────────────────
// TRACKING UPDATE — send tracking link template to customer
// ─────────────────────────────────────────────
const sendTrackingUpdate = async (to, customerName, orderId, trackingLink) => {
    const templateName = process.env.TEMPLATE_TRACKING_UPDATE || 'tracking_update';
    await sendTemplate(to, templateName, 'en', [customerName, orderId, trackingLink]);
    console.log(`📦 Tracking update sent to ${to} for order ${orderId}`);
};

// ─────────────────────────────────────────────
// SEND OTP — send verification_code authentication template
// ─────────────────────────────────────────────
const sendOTP = async (to, otp) => {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: 'verification_code',
                language: { code: 'en' },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            {
                                type: 'text',
                                text: otp,
                            },
                        ],
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [
                            {
                                type: 'text',
                                text: otp,
                            },
                        ],
                    },
                ],
            },
        };

        console.log(`🔐 Sending OTP to ${to}...`);
        const response = await axios.post(WA_API, payload, { headers: HEADERS });
        console.log(`✅ OTP template sent to ${to}`);
        return { success: true, data: response.data };
    } catch (e) {
        console.error('❌ sendOTP failed:', e.response?.data || e.message);
        return { success: false, error: e.response?.data || e.message };
    }
};

module.exports = {
    uploadMenuImage,
    sendReply,
    sendImage,
    sendTemplate,
    sendWelcome,
    sendCartSummary,
    sendNameRequest,
    sendLocationRequest,
    sendOrderSummary,
    sendOrderConfirmation,
    sendOrderConfirmationTemplate,
    sendOwnerAlert,
    sendOrderReceivedTemplate,
    sendTrackingUpdate,
    sendOTP,
};
