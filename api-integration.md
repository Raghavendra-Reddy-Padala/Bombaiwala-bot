# Bombaiwala — WhatsApp Templates & OTP Integration Guide

## Overview

This guide documents how WhatsApp template messages and OTP verification are integrated across the Bombaiwala stack:
- **Bot** (`/bot`) — Express server that sends WhatsApp messages via Meta Cloud API
- **Admin Dashboard** (`/admindashbaord`) — React admin panel for managing orders
- **Frontend** (`/fend`) — Customer-facing website

---

## Architecture

```
┌──────────────────┐     POST /api/tracking      ┌─────────────────┐
│  Admin Dashboard  │ ──────────────────────────▶ │                 │
│   (React/Vite)    │                             │   Bot Server    │
└──────────────────┘                              │  (Express.js)   │
                                                  │   port: 8001    │
┌──────────────────┐     POST /api/otp/send       │                 │
│  Frontend (Web)   │ ──────────────────────────▶ │   ──────────▶   │──▶ WhatsApp Cloud API
│                   │     POST /api/otp/verify     │                 │       (Meta)
└──────────────────┘ ──────────────────────────▶  │                 │
                                                  │   ──────────▶   │──▶ Firebase
                                                  │  otp_sessions   │    (Firestore)
                                                  └─────────────────┘
```

---

### Template Summary

| Template Name          | Category       | Sent To    | Triggered By                    | Parameters                                           |
|----------------------|----------------|------------|--------------------------------|------------------------------------------------------|
| `order_confirmation` | UTILITY        | Customer   | Order placement (bot or web)   | `{{1}}` name, `{{2}}` orderId, `{{3}}` total        |
| `order_received`     | UTILITY        | Owner      | Order placement (bot or web)   | `{{1}}` orderId, `{{2}}` name, `{{3}}` items, `{{4}}` total |
| `tracking_update`    | UTILITY        | Customer   | Admin sends tracking link      | `{{1}}` name, `{{2}}` orderId, `{{3}}` trackingLink |
| `verification_code`  | AUTHENTICATION | Customer   | OTP request from frontend      | Auto-managed by Meta (OTP in body)                   |



## API Endpoints (Bot Server)

Base URL: `http://localhost:8001` (or your deployed bot URL)

### 1. Submit Web Order
```
POST /api/orders
Content-Type: application/json

{
  "orderId": "WEB-1719756000000",
  "customerName": "John Doe",
  "customerPhone": "9032323095",
  "items": [{ "name": "Pav Bhaji", "qty": 2, "price": 120, "total": 240 }],
  "subtotal": 240,
  "deliveryFee": 30,
  "totalAmount": 270,
  "deliveryType": "rapido"
}

Response: { "success": true, "message": "Order processed and WhatsApp messages sent." }
```
**What happens:** Sends `order_confirmation` template to customer + `order_received` template to owner.

---

### 2. Send Tracking Link
```
POST /api/tracking
Content-Type: application/json

{
  "orderId": "BW-1719756000000",
  "customerPhone": "919032323095",
  "customerName": "John Doe",
  "trackingLink": "https://rapido.bike/track/abc123"
}

Response: { "success": true, "message": "Tracking link sent to 919032323095 for order BW-..." }
```
**What happens:** Sends `tracking_update` template to customer via WhatsApp.

**Used by:** Admin Dashboard → Order Drawer → "Send Tracking Link" section.

---

### 3. Send OTP
```
POST /api/otp/send
Content-Type: application/json

{
  "phone": "9032323095"
}

Response: { "success": true, "message": "OTP sent to 919032323095" }
```
**What happens:**
1. Generates a random 6-digit OTP
2. Saves to Firebase `otp_sessions/{phone}` with 10-min expiry
3. Sends `verification_code` template via WhatsApp

**Firebase Document (`otp_sessions/919032323095`):**
```json
{
  "phone": "919032323095",
  "otp": "483921",
  "createdAt": "2026-06-30T12:00:00.000Z",
  "expiresAt": "2026-06-30T12:10:00.000Z",
  "expiresAtMs": 1719748800000,
  "verified": false,
  "attempts": 0
}
```

---

### 4. Verify OTP
```
POST /api/otp/verify
Content-Type: application/json

{
  "phone": "9032323095",
  "otp": "483921"
}

Success Response: { "success": true, "message": "OTP verified successfully!", "verified": true }
Failure Response: { "success": false, "message": "Incorrect OTP. 3 attempts remaining.", "verified": false }
```

**Security:**
- OTPs expire after **10 minutes**
- Max **5 attempts** before the OTP is invalidated
- After successful verification, the document is marked `verified: true`

---

## Frontend Integration (How to Use OTP)

### Example: Phone Verification Flow

```javascript
// Step 1: Send OTP when user enters phone number
async function sendOTP(phone) {
  const res = await fetch('http://localhost:8001/api/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json();
  if (data.success) {
    // Show OTP input field
    showOTPInput();
  } else {
    alert('Failed to send OTP: ' + data.error);
  }
}

// Step 2: Verify OTP when user enters the code
async function verifyOTP(phone, otp) {
  const res = await fetch('http://localhost:8001/api/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp }),
  });
  const data = await res.json();
  if (data.verified) {
    // Phone verified! Proceed with order
    proceedToCheckout();
  } else {
    alert(data.message); // "Incorrect OTP. 3 attempts remaining."
  }
}
```

---

## Admin Dashboard Integration (Tracking Link)

The tracking link feature is built into the **Order Drawer** (`Orders.tsx`).

### How It Works:
1. Admin opens an order in the Orders page
2. At the bottom of the drawer, there's a "Send Tracking Link" section
3. Admin pastes a tracking URL (e.g., Rapido, Dunzo, or any delivery tracking link)
4. Clicks "Send" → calls `POST /api/tracking`
5. Bot sends `tracking_update` WhatsApp template to the customer
6. The tracking link and timestamp are saved to the Firebase order document

### Environment Variable:
Add this to your admin dashboard's `.env` if the bot is not on localhost:
```
VITE_BOT_API_URL=https://your-bot-server.com
```

---

## Environment Variables (Bot `.env`)

```env
# WhatsApp Template Names — MUST match Meta WhatsApp Manager
TEMPLATE_ORDER_CONFIRMATION=order_confirmation
TEMPLATE_ORDER_RECEIVED=order_received
TEMPLATE_TRACKING_UPDATE=tracking_update

# Owner phone for order alerts
OWNER_PHONE=+919032323095
```

---

## File Map

```
bot/
├── utils/
│   ├── whatsapp.util.js     ← All WhatsApp sending functions (templates, OTP, etc.)
│   ├── otp.service.js       ← OTP generation, Firebase save/verify
│   ├── session.store.js     ← In-memory session for bot conversations
│   └── ...
├── controllers/
│   ├── api.controller.js    ← API handlers: orders, tracking, OTP
│   └── webhook.controller.js
├── routes/
│   ├── api.routes.js        ← POST /api/orders, /api/tracking, /api/otp/*
│   └── webhook.routes.js
├── handlers/
│   └── order.handler.js     ← Bot conversation flow (uses templates)
├── config/
│   └── firebase.js          ← Firebase initialization
└── .env                     ← Template names + credentials

admindashbaord/
└── src/pages/Orders.tsx     ← Order drawer with "Send Tracking Link" UI
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Template not sending | Check if template is **Approved** in WhatsApp Manager |
| "Template not found" error | Template name in `.env` must match exactly (case-sensitive, underscores) |
| OTP not received | Check bot logs for `sendOTP` errors. Ensure `verification_code` template is approved |
| Tracking link not sending | Check bot API is reachable from admin dashboard. Check CORS settings |
| "Message failed to send" | Outside 24-hour window? Templates bypass this. Check Meta token validity |
| OTP expired | OTPs last 10 minutes. User must request a new one |
