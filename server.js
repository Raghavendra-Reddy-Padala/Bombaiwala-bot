/**
 * Bombaiwala Chat — WhatsApp E-Commerce Bot
 * Express server entry point.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Routes
const webhookRoutes = require('./routes/webhook.routes');
const apiRoutes = require('./routes/api.routes');

// Utils
const { uploadMenuImage } = require('./utils/whatsapp.util');

const app = express();

// Global middleware
app.use(express.json());
app.use(cors());

// WhatsApp webhook routes
app.use('/', webhookRoutes);

// API routes for frontend
app.use('/api', apiRoutes);

// Health check
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Bombaiwala Chat Bot | Status</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #fff; }
                    .card { background: linear-gradient(135deg, #16213e 0%, #0f3460 100%); padding: 2.5rem; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; border-top: 6px solid #e94560; max-width: 420px; }
                    h1 { color: #ffd700; margin-bottom: 0.5rem; font-size: 1.8rem; }
                    .subtitle { color: #aaa; font-size: 0.9rem; margin-bottom: 1rem; }
                    .status-box { background: rgba(46, 213, 115, 0.15); color: #2ed573; padding: 8px 20px; border-radius: 20px; display: inline-block; font-weight: 600; margin: 15px 0; border: 1px solid rgba(46, 213, 115, 0.3); }
                    p { color: #ccc; line-height: 1.6; }
                    .emoji { font-size: 2.5rem; margin-bottom: 0.5rem; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="emoji">🟡</div>
                    <h1>Bombaiwala Chat</h1>
                    <div class="subtitle">WhatsApp E-Commerce Bot (GPT-Powered)</div>
                    <div class="status-box">● BOT ONLINE</div>
                    <p>The WhatsApp ordering bot is running and ready to take orders! 🍛</p>
                </div>
            </body>
        </html>
    `);
});

const PORT = process.env.PORT || 8001;
app.listen(PORT, async () => {
    console.log(`\n🟡 ════════════════════════════════════════`);
    console.log(`   Bombaiwala Chat Bot v2.0 (GPT-Powered)`);
    console.log(`   Running on port ${PORT}`);
    console.log(`   Firebase: bombaiwala-chat`);
    console.log(`   WhatsApp Bot: Active`);
    console.log(`🟡 ════════════════════════════════════════\n`);

    // Upload menu image to WhatsApp Media API
    console.log('📤 Uploading menu image to WhatsApp...');
    await uploadMenuImage();
});

