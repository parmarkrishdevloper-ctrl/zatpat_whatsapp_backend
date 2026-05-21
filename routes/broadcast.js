/**
 * routes/broadcast.js
 * Campaign / Broadcast System API
 *
 * GET    /api1/broadcast                    — list all campaigns
 * POST   /api1/broadcast                    — create campaign
 * GET    /api1/broadcast/:id                — get campaign detail
 * DELETE /api1/broadcast/:id                — delete campaign
 * POST   /api1/broadcast/:id/send           — start sending the campaign NOW (live)
 * POST   /api1/broadcast/:id/cancel         — cancel a scheduled/sending campaign
 *
 * Groups endpoint:
 * GET    /api1/broadcast/groups             — list available contact groups
 */

const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const Campaign = require('../models/Campaign');
const Contact  = require('../models/Contact');
const { authMiddleware } = require('../middleware/auth.cjs');

router.use(authMiddleware);

/* ── helper: fill {{variable}} ──────────────────────── */
function fillTemplate(body, phone, extraVars = {}) {
    return body
        .replaceAll('{{name}}', extraVars.name || phone)
        .replaceAll('{{phone}}', phone)
        .replace(/\{\{(\w+)\}\}/g, (_, k) => extraVars[k] || `[${k}]`);
}

/* ── helper: send one WhatsApp text message ─────────── */
async function sendWAMessage(to, body) {
    await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
            messaging_product: 'whatsapp',
            to,
            text: { body }
        },
        {
            headers: {
                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );
}

/* ── GET /broadcast/groups ────────────────────────────── */
router.get('/groups', async (req, res) => {
    try {
        const allContacts = await Contact.find({}, { phoneNumber: 1 });
        const allNums = allContacts.map(c => c.phoneNumber);

        // We compute a 30-day inactive group
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const inactive = await Contact.find({ lastContactDate: { $lt: thirtyDaysAgo } }, { phoneNumber: 1 });

        const groups = [
            { id: 'all',      name: 'All Contacts',    count: allContacts.length,  filter: {} },
            { id: 'inactive', name: 'Inactive (30d)',  count: inactive.length,     filter: { lastContactDate: { $lt: thirtyDaysAgo } } }
        ];

        res.json({ success: true, data: groups });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET /broadcast ──────────────────────────────────── */
router.get('/', async (req, res) => {
    try {
        const campaigns = await Campaign.find().sort({ createdAt: -1 });
        res.json({ success: true, count: campaigns.length, data: campaigns });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET /broadcast/:id ──────────────────────────────── */
router.get('/:id', async (req, res) => {
    try {
        const c = await Campaign.findById(req.params.id);
        if (!c) return res.status(404).json({ success: false, message: 'Campaign not found' });
        res.json({ success: true, data: c });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST /broadcast ─────────────────────────────────── */
/**
 * Body:
 * {
 *   name: "Festive Offer",
 *   groupId: "all" | "inactive" | "custom",
 *   recipients: ["919...", "918..."],  // only if groupId = 'custom'
 *   message: "Hi {{name}}, great offer!",
 *   scheduledAt: "2025-11-01T09:30:00Z"  // optional, null = not scheduled
 * }
 */
router.post('/', async (req, res) => {
    try {
        const { name, groupId, recipients: customRecipients, message, scheduledAt } = req.body;

        if (!name || !message) {
            return res.status(400).json({ success: false, message: 'name and message are required' });
        }

        let recipients = [];
        let groupName  = 'Custom';

        if (groupId === 'all') {
            const contacts = await Contact.find({}, { phoneNumber: 1 });
            recipients = contacts.map(c => c.phoneNumber);
            groupName  = 'All Contacts';
        } else if (groupId === 'inactive') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const contacts = await Contact.find({ lastContactDate: { $lt: thirtyDaysAgo } }, { phoneNumber: 1 });
            recipients = contacts.map(c => c.phoneNumber);
            groupName  = 'Inactive (30d)';
        } else if (Array.isArray(customRecipients) && customRecipients.length) {
            recipients = customRecipients;
            groupName  = `Custom (${recipients.length})`;
        } else {
            return res.status(400).json({ success: false, message: 'Provide groupId or recipients[]' });
        }

        const campaign = await Campaign.create({
            name,
            groupName,
            recipients,
            recipientCount: recipients.length,
            message,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            status: scheduledAt ? 'scheduled' : 'draft'
        });

        res.status(201).json({ success: true, message: 'Campaign created', data: campaign });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── DELETE /broadcast/:id ───────────────────────────── */
router.delete('/:id', async (req, res) => {
    try {
        const c = await Campaign.findByIdAndDelete(req.params.id);
        if (!c) return res.status(404).json({ success: false, message: 'Campaign not found' });
        res.json({ success: true, message: 'Campaign deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST /broadcast/:id/cancel ──────────────────────── */
router.post('/:id/cancel', async (req, res) => {
    try {
        const c = await Campaign.findByIdAndUpdate(
            req.params.id,
            { status: 'cancelled' },
            { new: true }
        );
        if (!c) return res.status(404).json({ success: false, message: 'Campaign not found' });
        res.json({ success: true, message: 'Campaign cancelled', data: c });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST /broadcast/:id/send ────────────────────────── */
/**
 * Starts sending messages to all recipients using the WhatsApp Cloud API.
 * Runs sequentially with 500ms delay to respect rate limits.
 * Responds immediately (202) and processes in the background.
 */
router.post('/:id/send', async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

        if (['sending', 'completed'].includes(campaign.status)) {
            return res.status(400).json({ success: false, message: `Campaign is already ${campaign.status}` });
        }

        // Update status to sending
        await Campaign.findByIdAndUpdate(campaign._id, { status: 'sending', startedAt: new Date() });

        // Respond immediately so the request doesn't hang
        res.status(202).json({
            success: true,
            message: `Campaign "${campaign.name}" started. Sending to ${campaign.recipientCount} recipients.`,
            data: { campaignId: campaign._id, recipients: campaign.recipientCount }
        });

        // Background send
        let delivered = 0;
        let failed    = 0;
        const errors  = [];

        for (const phone of campaign.recipients) {
            const body = fillTemplate(campaign.message, phone);
            try {
                await sendWAMessage(phone, body);
                delivered++;
                console.log(`✅ [BROADCAST] Sent to ${phone} (${delivered}/${campaign.recipientCount})`);
            } catch (err) {
                failed++;
                const errMsg = err.response?.data?.error?.message || err.message;
                errors.push({ phone, error: errMsg, at: new Date() });
                console.error(`❌ [BROADCAST] Failed for ${phone}: ${errMsg}`);
            }

            // Throttle: 500ms between messages (WhatsApp Cloud API rate limit safety)
            await new Promise(r => setTimeout(r, 500));
        }

        // Mark completed
        await Campaign.findByIdAndUpdate(campaign._id, {
            status: failed === campaign.recipients.length ? 'failed' : 'completed',
            delivered,
            failed,
            completedAt: new Date(),
            $push: { errors: { $each: errors } }
        });

        console.log(`🏁 [BROADCAST] Campaign "${campaign.name}" done. Delivered: ${delivered}, Failed: ${failed}`);
    } catch (err) {
        console.error('[Broadcast send error]', err.message);
        // Try to mark campaign as failed
        try {
            await Campaign.findByIdAndUpdate(req.params.id, { status: 'failed' });
        } catch {}
        // Only send error if headers haven't been sent
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

/* ── POST /broadcast/:id/track-reply ─────────────────── */
/**
 * Called internally when a user replies to a broadcast message.
 * Track reply: { phone: "91XXXXXXXXXX" }
 */
router.post('/:id/track-reply', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ success: false, message: 'phone required' });

        const campaign = await Campaign.findByIdAndUpdate(
            req.params.id,
            {
                $inc: { replies: 1 },
                $addToSet: { repliedNumbers: phone }
            },
            { new: true }
        );
        res.json({ success: true, data: campaign });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
