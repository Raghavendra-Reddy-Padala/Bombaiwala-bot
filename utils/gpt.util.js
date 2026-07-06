/**
 * GPT Utility — Natural language order parsing using OpenAI.
 * Takes the user's free-text order and matches it to live Firestore items.
 */

const OpenAI = require('openai');
const { db, collection, getDocs } = require('../config/firebase');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Helper: Fetches live Firestore items and formats them into plain text for the OpenAI system context.
 */
const getLiveMenuTextForGPT = async () => {
    try {
        const productsRef = collection(db, 'products'); 
        const snapshot = await getDocs(productsRef);
        
        let text = 'BOMBAIWALA LIVE MENU:\n\n';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const price = data.sellingPrice || data.price || 0;
            text += `  - "${data.name}" (ID: ${doc.id}) — ₹${price} [Brand: ${data.brand || 'chaat'}]\n`;
        });
        
        return text;
    } catch (error) {
        console.error('❌ Failed to construct menu context from Firestore:', error);
        return 'Menu temporarily unavailable.';
    }
};

/**
 * Parse a natural language order into structured cart items.
 * @param {string} userText — e.g. "2 pav bhaji butter, 1 cheese bhel, 3 vada pav"
 * @returns {{ success: boolean, cart?: Array<{id, name, price, qty}>, message?: string }}
 */
const parseOrderText = async (userText) => {
    // 1. Fetch live text schema snapshot directly from Firestore collections
    const menuText = await getLiveMenuTextForGPT();

    const systemPrompt = `You are an order-taking assistant for Bombaiwala, a street food restaurant.
Your job is to parse the customer's message into a structured order.

Here is the complete live menu from our database:
${menuText}

RULES:
1. Match the customer's text to items on the menu. Be flexible with naming — "pav bhaji" matches "Pav Bhaji (Butter)", "cheese vp" matches "Cheese Grill Vada Pav", etc.
2. Extract quantities. If no quantity is mentioned, assume 1.
3. If an item cannot be matched to ANY menu item, include it in an "unmatched" array.
4. Return ONLY valid JSON, no markdown or explanation.

RESPONSE FORMAT (strict JSON):
{
  "matched": [
    { "id": "item_id", "name": "Full Item Name", "price": 80, "qty": 2 }
  ],
  "unmatched": ["item description that couldn't be matched"]
}

If the message doesn't seem like a food order at all, return:
{ "matched": [], "unmatched": [], "error": "not_an_order" }`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText },
            ],
            temperature: 0.1,
            max_tokens: 1000,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);

        if (parsed.matched && parsed.matched.length > 0) {
            const validatedCart = parsed.matched.map(item => ({
                id: item.id,
                name: item.name,
                price: parseInt(item.price) || 0,
                qty: Math.min(Math.max(parseInt(item.qty) || 1, 1), 20),
            }));

            return {
                success: true,
                cart: validatedCart,
                unmatched: parsed.unmatched && parsed.unmatched.length > 0 ? parsed.unmatched : undefined,
            };
        }

        if (parsed.error === 'not_an_order') {
            return {
                success: false,
                message: '🤔 That doesn\'t look like an order. Just tell me what you\'d like!\n\nFor example:\n_"2 pav bhaji, 1 cheese sandwich, 3 vada pav"_',
            };
        }

        return {
            success: false,
            message: '⚠️ I couldn\'t understand your order. Could you try again?\n\nFor example:\n_"2 pav bhaji, 1 cheese bhel"_',
        };

    } catch (err) {
        console.error('❌ GPT parseOrderText error:', err.message);
        return {
            success: false,
            message: '😔 Something went wrong understanding your order. Please try again.',
        };
    }
};

module.exports = { parseOrderText };