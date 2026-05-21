/**
 * routes/handover.js
 * Human Handover System API
 *
 * POST  /api1/handover/:phone/takeover  — agent takes over chat
 * POST  /api1/handover/:phone/return    — return chat to bot
 * POST  /api1/handover/:phone/send      — agent sends a message to user
 * GET   /api1/handover/:phone           — get controller for a phone
 * GET   /api1/handover                  — list all active human-controlled chats
 */

const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const Handover = require('../models/Handover');
const Conversation = require('../models/Conversation');
const { authMiddleware } = require('../middleware/auth.cjs');

router.use(authMiddleware);

/* ── GET /handover  — list all active handovers ─────── */
router.get('/', async (req, res) => {
    try {
        const handovers = await Handover.find({ controller: 'human' }).sort({ takenOverAt: -1 });
        res.json({ success: true, count: handovers.length, data: handovers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET /handover/:phone  — get status for a number ── */
router.get('/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const record = await Handover.findOne({ phoneNumber: phone });
        res.json({
            success: true,
            data: {
                phoneNumber: phone,
                controller: record?.controller || 'bot',
                agentName: record?.agentName || null,
                takenOverAt: record?.takenOverAt || null,
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST /handover/:phone/takeover ─────────────────── */
router.post('/:phone/takeover', async (req, res) => {
    try {
        const { phone } = req.params;
        const { agentName = 'Admin', notes = '' } = req.body;

        const record = await Handover.findOneAndUpdate(
            { phoneNumber: phone },
            {
                $set: {
                    controller: 'human',
                    agentName,
                    takenOverAt: new Date(),
                    notes
                },
                $push: {
                    history: { action: 'takeover', agent: agentName, at: new Date() }
                }
            },
            { upsert: true, new: true }
        );

        console.log(`🤝 [HANDOVER] ${phone} taken over by agent: ${agentName}`);
        res.json({ success: true, message: `Chat taken over by ${agentName}`, data: record });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST /handover/:phone/return ───────────────────── */
router.post('/:phone/return', async (req, res) => {
    try {
        const { phone } = req.params;
        const { agentName = 'Admin' } = req.body;

        const record = await Handover.findOneAndUpdate(
            { phoneNumber: phone },
            {
                $set: {
                    controller: 'bot',
                    returnedAt: new Date()
                },
                $push: {
                    history: { action: 'return', agent: agentName, at: new Date() }
                }
            },
            { upsert: true, new: true }
        );

        console.log(`🤖 [HANDOVER] ${phone} returned to bot`);
        res.json({ success: true, message: 'Chat returned to bot', data: record });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST /handover/:phone/send — agent sends message to user ── */
router.post('/:phone/send', async (req, res) => {
    try {
        const { phone } = req.params;
        const { message, agentName = 'Admin' } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message cannot be empty' });
        }

        // Only allow if under human control
        const record = await Handover.findOne({ phoneNumber: phone });
        if (!record || record.controller !== 'human') {
            return res.status(403).json({ success: false, error: 'Chat is not under human control. Take over first.' });
        }

        const { WHATSAPP_TOKEN, PHONE_NUMBER_ID } = process.env;

        // Send via WhatsApp Cloud API
        await axios.post(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                to: phone,
                text: { body: message.trim() }
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Save agent message to conversation so it shows in chat history
        const now = new Date();
        await Conversation.findOneAndUpdate(
            { phoneNumber: phone },
            {
                $push: {
                    messages: {
                        role: 'agent',
                        content: `[${agentName}]: ${message.trim()}`,
                        timestamp: now,
                        inputTokens: 0,
                        outputTokens: 0
                    }
                },
                $set: { updatedAt: now }
            },
            { upsert: true, new: true }
        );

        console.log(`📤 [HANDOVER] Agent "${agentName}" sent message to ${phone}: ${message.trim()}`);
        res.json({ success: true, message: 'Message sent successfully', sentAt: now });
    } catch (err) {
        console.error('[HANDOVER SEND ERROR]', err.response?.data || err.message);
        res.status(500).json({ success: false, error: err.response?.data?.error?.message || err.message });
    }
});

module.exports = router;

