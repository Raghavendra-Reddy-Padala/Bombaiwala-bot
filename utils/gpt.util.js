

const OpenAI = require('openai');
const { getMenuTextForGPT, getAllItems } = require('../data/menu');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Parse a natural language order into structured cart items.
 * @param {string} userText — e.g. "2 pav bhaji butter, 1 cheese bhel, 3 vada pav"
 * @returns {{ success: boolean, cart?: Array<{id, name, price, qty}>, message?: string }}
 */
const parseOrderText = async (userText) => {
    const menuText = getMenuTextForGPT();
    const allItems = getAllItems();

    const systemPrompt = `You are an order-taking assistant for Bombaiwala, a street food restaurant.
Your job is to parse the customer's message into a structured order.

Here is the complete menu:
${menuText}

RULES:
1. Match the customer's text to items on the menu. Be flexible with naming — "pav bhaji" matches "Pav Bhaji (Butter)", "cheese vp" matches "Cheese Grill Vada Pav", etc.
2. If a customer says just a category name (e.g., "pav bhaji"), default to the basic variant.
3. Extract quantities. If no quantity is mentioned, assume 1.
4. If an item cannot be matched to ANY menu item, include it in an "unmatched" array.
5. Return ONLY valid JSON, no markdown or explanation.

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

        // Validate matched items against actual menu
        if (parsed.matched && parsed.matched.length > 0) {
            const validatedCart = [];
            const newUnmatched = parsed.unmatched || [];

            for (const item of parsed.matched) {
                // Verify the item ID exists in our menu
                const menuItem = allItems.find(m => m.id === item.id);
                if (menuItem) {
                    validatedCart.push({
                        id: menuItem.id,
                        name: menuItem.name,
                        price: menuItem.price,
                        qty: Math.min(Math.max(parseInt(item.qty) || 1, 1), 20),
                    });
                } else {
                    // GPT gave a wrong ID — try fuzzy match by name
                    const fuzzyMatch = allItems.find(m =>
                        m.name.toLowerCase().includes(item.name?.toLowerCase()?.split(' ')[0] || '') ||
                        item.name?.toLowerCase()?.includes(m.name.toLowerCase().split(' ')[0] || '')
                    );
                    if (fuzzyMatch)   {
                        validatedCart.push({
                            id: fuzzyMatch.id,
                            name: fuzzyMatch.name,
                            price: fuzzyMatch.price,
                            qty: Math.min(Math.max(parseInt(item.qty) || 1, 1), 20),
                        });
                    } else {
                        newUnmatched.push(item.name || 'unknown item');
                    }
                }
            }

            if (validatedCart.length === 0) {
                return {
                    success: false,
                    message: '⚠️ Sorry, I couldn\'t match any of those items to our menu. Could you try again? For example:\n\n_"2 pav bhaji, 1 cheese sandwich"_',
                };
            }

            return {
                success: true,
                cart: validatedCart,
                unmatched: newUnmatched.length > 0 ? newUnmatched : undefined,
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
