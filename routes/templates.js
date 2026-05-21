/**
 * routes/templates.js
 * Template Management API
 *
 * GET    /api1/templates           — list all templates
 * POST   /api1/templates           — create template
 * PUT    /api1/templates/:id       — update template
 * DELETE /api1/templates/:id       — delete template
 * POST   /api1/templates/:id/send  — send template to a specific phone number (live WhatsApp)
 */

const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const Template = require('../models/Template');
const { authMiddleware } = require('../middleware/auth.cjs');

router.use(authMiddleware);

/* ── helper: parse {{variables}} from body ─────────── */
function parseVars(text) {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

/* ── helper: fill variables in a template body ──────── */
function fillTemplate(body, vars = {}) {
    let result = body;
    Object.keys(vars).forEach(key => {
        result = result.replaceAll(`{{${key}}}`, vars[key]);
    });
    return result;
}

/* ── GET /templates ──────────────────────────────────── */
router.get('/', async (req, res) => {
    try {
        const templates = await Template.find().sort({ createdAt: -1 });
        res.json({ success: true, count: templates.length, data: templates });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET /templates/:id ──────────────────────────────── */
router.get('/:id', async (req, res) => {
    try {
        const tpl = await Template.findById(req.params.id);
        if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' });
        res.json({ success: true, data: tpl });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST /templates ─────────────────────────────────── */
router.post('/', async (req, res) => {
    try {
        const { name, category, body, color } = req.body;
        if (!name || !body) {
            return res.status(400).json({ success: false, message: 'name and body are required' });
        }

        const variables = parseVars(body);
        const tpl = await Template.create({ name, category: category || 'General', body, variables, color: color || 'blue' });
        res.status(201).json({ success: true, message: 'Template created', data: tpl });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── PUT /templates/:id ──────────────────────────────── */
router.put('/:id', async (req, res) => {
    try {
        const { name, category, body, color } = req.body;
        const update = {};
        if (name)     update.name = name;
        if (category) update.category = category;
        if (color)    update.color = color;
        if (body) {
            update.body = body;
            update.variables = parseVars(body);
        }

        const tpl = await Template.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' });
        res.json({ success: true, message: 'Template updated', data: tpl });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── DELETE /templates/:id ───────────────────────────── */
router.delete('/:id', async (req, res) => {
    try {
        const tpl = await Template.findByIdAndDelete(req.params.id);
        if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' });
        res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST /templates/:id/send ────────────────────────── */
/**
 * Send a template to a single WhatsApp number.
 * Body: { phone: "91XXXXXXXXXX", variables: { name: "Krish", loanType: "Home Loan" } }
 */
router.post('/:id/send', async (req, res) => {
    try {
        const { phone, variables = {} } = req.body;
        if (!phone) return res.status(400).json({ success: false, message: 'phone is required' });

        const tpl = await Template.findById(req.params.id);
        if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' });

        const messageBody = fillTemplate(tpl.body, variables);

        // Send via WhatsApp Cloud API
        await axios.post(
            `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: phone,
                text: { body: messageBody }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`📤 [TEMPLATE] Sent "${tpl.name}" to ${phone}`);
        res.json({ success: true, message: `Template "${tpl.name}" sent to ${phone}`, body: messageBody });
    } catch (err) {
        const fbError = err.response?.data?.error?.message || err.message;
        console.error('[Template send error]', fbError);
        res.status(500).json({ success: false, error: fbError });
    }
});

module.exports = router;
