/**
 * Order Handler — Simplified conversation state machine for Bombaiwala Chat bot.
 *
 * New Flow (GPT-powered):
 *  idle → hi → send menu image → awaiting_order_text
 *  → user types order → GPT parses → show cart → awaiting_checkout
 *  → checkout → awaiting_name → enter name → awaiting_location → share location
 *  → awaiting_confirm → confirm → save to Firebase → idle
 */

const {
  getSession,
  setSession,
  clearSession,
} = require("../utils/session.store");
const { calculateDeliveryFee } = require("../utils/distance.util");
const { db, doc, setDoc, collection } = require("../config/firebase");
const { parseOrderText } = require("../utils/gpt.util");
const {
  sendReply,
  sendWelcome,
  sendCartSummary,
  sendNameRequest,
  sendLocationRequest,
  sendOrderSummary,
  sendOrderConfirmation,
  sendOrderConfirmationTemplate,
  sendOwnerAlert,
} = require("../utils/whatsapp.util");

// ─────────────────────────────────────────────
// ENTRY POINT — called from webhook controller
// ─────────────────────────────────────────────
const handleMessage = async (sender, msgType, message) => {
  const session = getSession(sender) || { state: "idle" };

  // ── TEXT MESSAGES ──
  if (msgType === "text") {
    const text = message.text.body.trim();
    const lower = text.toLowerCase();

    // Greeting → restart flow
    if (["hi", "hello", "hey", "start", "menu"].includes(lower)) {
      clearSession(sender);
      await sendWelcome(sender);
      setSession(sender, { state: "awaiting_order_text", cart: [] });
      return;
    }

    // Cancel at any point
    if (["cancel", "quit", "exit", "stop"].includes(lower)) {
      clearSession(sender);
      await sendReply(sender, "❌ Order cancelled. Type *hi* to start again.");
      return;
    }

    // State-specific text handling
    switch (session.state) {
      case "awaiting_order_text":
        return await handleOrderText(sender, text, session);
      case "awaiting_name":
        return await handleName(sender, text, session);
      default:
        // Unknown text → show welcome with menu
        await sendWelcome(sender);
        setSession(sender, { state: "awaiting_order_text", cart: [] });
        return;
    }
  }

  // ── LOCATION MESSAGES ──
  if (msgType === "location") {
    if (session.state === "awaiting_location") {
      return await handleLocation(sender, message, session);
    }
    // Ignore location if not expected
    await sendReply(
      sender,
      "📍 Thanks for the location! But we don't need it right now.\nType *hi* to start ordering.",
    );
    return;
  }

  // ── INTERACTIVE BUTTON REPLIES ──
  if (
    msgType === "interactive" &&
    message.interactive.type === "button_reply"
  ) {
    const btnId = message.interactive.button_reply.id;
    return await handleButtonReply(sender, btnId, session);
  }
};

// ─────────────────────────────────────────────
// ORDER TEXT — parse with GPT
// ─────────────────────────────────────────────
const handleOrderText = async (sender, text, session) => {
  // Show typing indicator
  await sendReply(sender, "🔄 _Reading your order..._");

  const result = await parseOrderText(text);

  if (!result.success) {
    await sendReply(sender, result.message);
    return;
  }

  // GPT parsed successfully — store cart and show summary
  setSession(sender, {
    state: "awaiting_checkout",
    cart: result.cart,
  });

  await sendCartSummary(sender, result.cart, result.unmatched);
};

// ─────────────────────────────────────────────
// BUTTON REPLIES
// ─────────────────────────────────────────────
const handleButtonReply = async (sender, btnId, session) => {
  // Checkout → ask for name
  if (btnId === "btn_checkout") {
    await sendNameRequest(sender);
    setSession(sender, { state: "awaiting_name" });
    return;
  }

  // Modify order → show menu again, let them retype
  if (btnId === "btn_modify_order") {
    await sendWelcome(sender);
    setSession(sender, { state: "awaiting_order_text", cart: [] });
    return;
  }

  // Confirm Order → save to Firebase
  if (btnId === "btn_confirm_order") {
    return await handleConfirmOrder(sender, session);
  }

  // Cancel Order
  if (btnId === "btn_cancel_order") {
    clearSession(sender);
    await sendReply(sender, "❌ Order cancelled. Type *hi* to start again.");
    return;
  }
};

// ─────────────────────────────────────────────
// NAME — collect customer name
// ─────────────────────────────────────────────
const handleName = async (sender, text, session) => {
  if (text.length < 2) {
    await sendReply(
      sender,
      "⚠️ Please enter your name (at least 2 characters).",
    );
    return;
  }

  setSession(sender, {
    state: "awaiting_location",
    customerName: text,
  });

  await sendLocationRequest(sender);
};

// ─────────────────────────────────────────────
// LOCATION — calculate delivery fee and show summary
// ─────────────────────────────────────────────
const handleLocation = async (sender, message, session) => {
  const lat = message.location.latitude;
  const lng = message.location.longitude;

  if (!lat || !lng) {
    await sendReply(
      sender,
      "⚠️ Could not read your location. Please try sharing again.",
    );
    return;
  }

  const deliveryInfo = calculateDeliveryFee(lat, lng);

  setSession(sender, {
    state: "awaiting_confirm",
    location: { lat, lng },
    deliveryInfo,
  });

  // Show final order summary with delivery info
  await sendOrderSummary(
    sender,
    session.cart,
    session.customerName,
    deliveryInfo,
  );
};

// ─────────────────────────────────────────────
// CONFIRM ORDER — save to Firebase
// ─────────────────────────────────────────────
const handleConfirmOrder = async (sender, session) => {
  try {
    const cart = session.cart || [];
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const deliveryFee = session.deliveryInfo?.deliveryFee || 0;
    const totalAmount = subtotal + deliveryFee;

    const orderId = `BW-${Date.now()}`;

    const orderData = {
      orderId,
      customerName: session.customerName || "Unknown",
      customerPhone: sender,
      items: cart.map((item) => ({
        name: item.name,
        price: item.price,
        qty: item.qty,
        total: item.price * item.qty,
      })),
      subtotal,
      deliveryFee,
      totalAmount,
      deliveryType: session.deliveryInfo?.isFree ? "free" : "rapido",
      distanceKm: session.deliveryInfo?.distanceKm || 0,
      location: session.location || null,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    // Save to Firebase
    const orderRef = doc(collection(db, "orders"), orderId);
    await setDoc(orderRef, orderData);

    console.log(
      `✅ Order saved: ${orderId} | ₹${totalAmount} | ${session.customerName}`,
    );

    // Send confirmation to customer (template with name, fallback to plain text)
    try {
      await sendOrderConfirmationTemplate(
        sender,
        session.customerName || "Customer",
        orderId,
        totalAmount,
      );
    } catch (e) {
      console.warn(
        "⚠️ Template confirmation failed, using plain text fallback",
      );
      await sendOrderConfirmation(
        sender,
        orderId,
        totalAmount,
        session.deliveryInfo?.isFree,
      );
    }

    // Send template alert to owner
    await sendOwnerAlert(orderData);

    // Clear session
    clearSession(sender);
  } catch (err) {
    console.error("❌ Failed to save order:", err);
    await sendReply(
      sender,
      "😔 Something went wrong saving your order.\n" +
        "Please try again or call us directly.\n\n" +
        "Type *hi* to start over.",
    );
    clearSession(sender);
  }
};

module.exports = { handleMessage };
