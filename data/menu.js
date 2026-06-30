/**
 * Bombaiwala Chat — Full Menu Data
 * Prices are PARCEL prices (delivery orders).
 * Each category has an emoji icon and list of items.
 */

const MENU = {
    categories: [
        {
            id: 'paani_puri',
            name: '🥣 Paani Puri',
            emoji: '🥣',
            items: [
                { id: 'pp_1', name: 'Paani Puri (10 pcs)', price: 40 },
            ],
        },
        {
            id: 'vada_pav',
            name: '🍔 Vada Pav',
            emoji: '🍔',
            items: [
                { id: 'vp_1', name: 'Vada Pav (Butter)', price: 35 },
                { id: 'vp_2', name: 'Cheese Grill Vada Pav', price: 55 },
                { id: 'vp_3', name: 'Cheese Schezwan Grill Vada Pav', price: 55 },
            ],
        },
        {
            id: 'pav_bhaji',
            name: '🍛 Pav Bhaji',
            emoji: '🍛',
            items: [
                { id: 'pb_1', name: 'Pav Bhaji (Butter)', price: 80 },
                { id: 'pb_2', name: 'Paneer Pav Bhaji', price: 100 },
                { id: 'pb_3', name: 'Cheese Pav Bhaji', price: 100 },
                { id: 'pb_4', name: 'Paneer Cheese Pav Bhaji', price: 120 },
                { id: 'pb_5', name: 'Masala Pav Bhaji', price: 90 },
                { id: 'pb_6', name: 'Cheese Masala Pav Bhaji', price: 110 },
                { id: 'pb_7', name: 'Extra Pav (1 piece)', price: 20 },
            ],
        },
        {
            id: 'basket_chaat',
            name: '🧺 Basket Chaat',
            emoji: '🧺',
            items: [
                { id: 'bc_1', name: 'Basket Chaat', price: 90 },
                { id: 'bc_2', name: 'Sev Puri', price: 60 },
                { id: 'bc_3', name: 'Masala Puri', price: 60 },
            ],
        },
        {
            id: 'bhel',
            name: '🥗 Bhel',
            emoji: '🥗',
            items: [
                { id: 'bh_1', name: 'Bhel Puri', price: 60 },
                { id: 'bh_2', name: 'Cheese Bhel', price: 80 },
                { id: 'bh_3', name: 'Dhahi Bhel', price: 70 },
            ],
        },
        {
            id: 'tikki_chaat',
            name: '🥔 Tikki & Chaat',
            emoji: '🥔',
            items: [
                { id: 'tc_1', name: 'Aloo Tikki (Cutlet) Chaat', price: 60 },
                { id: 'tc_2', name: 'Samosa Chaat', price: 60 },
                { id: 'tc_3', name: 'Papdi Chaat', price: 60 },
            ],
        },
        {
            id: 'dahi_specials',
            name: '🥛 Dahi Specials',
            emoji: '🥛',
            items: [
                { id: 'ds_1', name: 'Dahi Puri', price: 60 },
                { id: 'ds_2', name: 'Dahi Samosa', price: 60 },
                { id: 'ds_3', name: 'Dahi Papdi', price: 60 },
            ],
        },
        {
            id: 'sandwiches',
            name: '🥪 Sandwiches',
            emoji: '🥪',
            items: [
                { id: 'sw_1', name: 'Veg Grill Sandwich', price: 70 },
                { id: 'sw_2', name: 'Veg Cheese Grill Sandwich', price: 90 },
                { id: 'sw_3', name: 'Paneer Sandwich', price: 90 },
                { id: 'sw_4', name: 'Paneer Cheese Sandwich', price: 110 },
                { id: 'sw_5', name: 'Veg Schezwan Grill Sandwich', price: 75 },
                { id: 'sw_6', name: 'Veg Cheese Schezwan Grill', price: 90 },
            ],
        },
    ],
};

/**
 * Helper: Get a category by ID
 */
const getCategoryById = (categoryId) => {
    return MENU.categories.find(c => c.id === categoryId) || null;
};

/**
 * Helper: Get an item by ID (searches all categories)
 */
const getItemById = (itemId) => {
    for (const cat of MENU.categories) {
        const item = cat.items.find(i => i.id === itemId);
        if (item) return { ...item, category: cat.name };
    }
    return null;
};

/**
 * Helper: Get all categories (for the list menu)
 */
const getAllCategories = () => {
    return MENU.categories.map(c => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        itemCount: c.items.length,
    }));
};

/**
 * Helper: Get full menu as plain text for GPT context.
 * Used to give GPT the complete menu so it can match user orders.
 */
const getMenuTextForGPT = () => {
    let text = 'BOMBAIWALA MENU:\n\n';
    for (const cat of MENU.categories) {
        text += `${cat.emoji} ${cat.name}:\n`;
        for (const item of cat.items) {
            text += `  - "${item.name}" (ID: ${item.id}) — ₹${item.price}\n`;
        }
        text += '\n';
    }
    return text;
};

/**
 * Helper: Get all items as a flat array (for fuzzy matching fallback)
 */
const getAllItems = () => {
    const items = [];
    for (const cat of MENU.categories) {
        for (const item of cat.items) {
            items.push({ ...item, category: cat.name });
        }
    }
    return items;
};

module.exports = { MENU, getCategoryById, getItemById, getAllCategories, getMenuTextForGPT, getAllItems };
