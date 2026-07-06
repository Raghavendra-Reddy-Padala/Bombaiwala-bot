/**
 * Webhook Controller for Bombaiwala Chat WhatsApp Bot.
 * Handles Meta webhook verification and incoming message routing.
 */

const { handleMessage } = require('../handlers/order.handler');

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'bombaiwala_secure_2026';

/**
 * GET /webhook — Meta webhook verification
 */
exports.verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ WEBHOOK VERIFIED!');
        res.status(200).send(challenge);
    } else {
        console.warn('⚠️ Webhook verification failed');
        res.sendStatus(403);
    }
};

/**
 * POST /webhook — Incoming WhatsApp messages
 */
exports.handleWebhook = async (req, res) => {
    // Respond to Meta immediately (must be fast)
    res.sendStatus(200);
    
    try {
        const body = req.body;

        if (!body.object) return;
        if (!body.entry?.[0]?.changes?.[0]?.value?.messages) return;

        const value = body.entry[0].changes[0].value;
        const message = value.messages[0];
        const sender = message.from; // WhatsApp number e.g. "919032323095"
        const msgType = message.type; // "text", "interactive", "location", etc.

        console.log(`📨 [Bombaiwala] Message from ${sender} | type: ${msgType}`);

        // Delegate to order handler
        await handleMessage(sender, msgType, message);

    } catch (err) {
        console.error('❌ Webhook processing error:', err);
    }
};
