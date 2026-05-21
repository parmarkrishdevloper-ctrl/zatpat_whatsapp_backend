/**
 * routes/analytics.js
 * Conversation Analytics API
 *
 * GET /api1/analytics/overview    — total messages, reply rate, avg response time
 * GET /api1/analytics/weekly      — messages per day (last 7 days)
 * GET /api1/analytics/resolution  — bot resolution vs human takeover %
 * GET /api1/analytics/top-queries — top query topics (from messages)
 */

const express  = require('express');
const router   = express.Router();
const Conversation = require('../models/Conversation');
const Contact      = require('../models/Contact');
const Handover     = require('../models/Handover');
const { authMiddleware } = require('../middleware/auth.cjs');

router.use(authMiddleware);

/* ── helpers ────────────────────────────────────────── */
function msAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
}

/* ── GET /analytics/overview ────────────────────────── */
router.get('/overview', async (req, res) => {
    try {
        // Total messages across all conversations
        const allConvs = await Conversation.find({}, { messages: 1 });
        let totalMessages    = 0;
        let userMessages     = 0;
        let assistantMessages = 0;
        let totalResponseMs  = 0;
        let responsePairs    = 0;

        allConvs.forEach(conv => {
            for (let i = 0; i < conv.messages.length; i++) {
                totalMessages++;
                if (conv.messages[i].role === 'user') {
                    userMessages++;
                    // Check if next message is assistant (for response time)
                    if (conv.messages[i + 1] && conv.messages[i + 1].role === 'assistant') {
                        const userTs  = new Date(conv.messages[i].timestamp).getTime();
                        const botTs   = new Date(conv.messages[i + 1].timestamp).getTime();
                        const diffMs  = botTs - userTs;
                        if (diffMs > 0 && diffMs < 60000) { // ignore > 1 min (session gap)
                            totalResponseMs += diffMs;
                            responsePairs++;
                        }
                    }
                } else if (conv.messages[i].role === 'assistant') {
                    assistantMessages++;
                }
            }
        });

        // Reply success rate: conversations where bot replied at least once
        const totalContacts = await Contact.countDocuments();
        const replySuccessRate = userMessages > 0 ? ((assistantMessages / userMessages) * 100).toFixed(1) : 0;
        const avgResponseTimeSec = responsePairs > 0 ? (totalResponseMs / responsePairs / 1000).toFixed(1) : 0;

        // Human handover count
        const handoverCount  = await Handover.countDocuments({ controller: 'human' });
        const humanTakeoverPct = totalContacts > 0 ? ((handoverCount / totalContacts) * 100).toFixed(1) : 0;
        const botResolutionPct = (100 - parseFloat(humanTakeoverPct)).toFixed(1);

        res.json({
            success: true,
            data: {
                totalMessages,
                userMessages,
                assistantMessages,
                replySuccessRate: parseFloat(replySuccessRate),
                avgResponseTimeSec: parseFloat(avgResponseTimeSec),
                totalContacts,
                handoverCount,
                botResolutionPct: parseFloat(botResolutionPct),
                humanTakeoverPct: parseFloat(humanTakeoverPct)
            }
        });
    } catch (err) {
        console.error('[Analytics] overview error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET /analytics/weekly ──────────────────────────── */
router.get('/weekly', async (req, res) => {
    try {
        const days = 7;
        const result = [];

        for (let i = days - 1; i >= 0; i--) {
            const start = new Date();
            start.setDate(start.getDate() - i);
            start.setHours(0, 0, 0, 0);

            const end = new Date(start);
            end.setHours(23, 59, 59, 999);

            const convs = await Conversation.find({
                createdAt: { $gte: start, $lte: end }
            }, { messages: 1 });

            let msgCount = 0;
            convs.forEach(c => { msgCount += c.messages.length; });

            result.push({
                date: start.toISOString().split('T')[0],
                day: start.toLocaleDateString('en-US', { weekday: 'short' }),
                messages: msgCount,
                conversations: convs.length
            });
        }

        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET /analytics/resolution ──────────────────────── */
router.get('/resolution', async (req, res) => {
    try {
        const totalContacts  = await Contact.countDocuments();
        const humanHandovers = await Handover.countDocuments({ 'history.action': 'takeover' });
        const botResolved    = Math.max(0, totalContacts - humanHandovers);

        res.json({
            success: true,
            data: {
                totalContacts,
                botResolved,
                humanHandovers,
                botPct:   totalContacts ? ((botResolved   / totalContacts) * 100).toFixed(1) : 0,
                humanPct: totalContacts ? ((humanHandovers / totalContacts) * 100).toFixed(1) : 0
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET /analytics/top-queries ─────────────────────── */
router.get('/top-queries', async (req, res) => {
    try {
        // Keyword frequency from user messages
        const KEYWORDS = [
            { label: 'Loan eligibility',       terms: ['eligible', 'eligibility', 'qualify', 'amount'] },
            { label: 'EMI calculation',         terms: ['emi', 'installment', 'monthly', 'calculate'] },
            { label: 'Document requirement',    terms: ['document', 'docs', 'papers', 'upload', 'submit'] },
            { label: 'Interest rate query',     terms: ['interest', 'rate', 'percentage', '%'] },
            { label: 'Repayment schedule',      terms: ['repay', 'schedule', 'tenure', 'duration'] },
            { label: 'Loan status / callback',  terms: ['status', 'callback', 'call', 'update'] },
            { label: 'Home Loan',               terms: ['home loan', 'house', 'property', 'mortgage'] },
            { label: 'Personal Loan',           terms: ['personal', 'personal loan'] },
            { label: 'Business Loan',           terms: ['business', 'business loan', 'msme'] },
        ];

        const convs = await Conversation.find({}, { messages: 1 });
        const counts = {};
        KEYWORDS.forEach(k => { counts[k.label] = 0; });

        convs.forEach(conv => {
            conv.messages.forEach(msg => {
                if (msg.role !== 'user') return;
                const text = msg.content.toLowerCase();
                KEYWORDS.forEach(k => {
                    if (k.terms.some(t => text.includes(t))) {
                        counts[k.label]++;
                    }
                });
            });
        });

        const sorted = Object.entries(counts)
            .map(([label, count]) => ({ label, count }))
            .filter(x => x.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        res.json({ success: true, data: sorted });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET /analytics/ai-summary/:phone ───────────────── */
router.get('/ai-summary/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const conversations = await Conversation.find({ phoneNumber: phone })
            .sort({ createdAt: -1 })
            .limit(5);

        if (!conversations.length) {
            return res.status(404).json({ success: false, message: 'No conversations found' });
        }

        // Flatten all messages
        const messages = [];
        conversations.forEach(conv => {
            conv.messages.forEach(m => messages.push(m));
        });
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const userMsgs = messages.filter(m => m.role === 'user');
        const botMsgs  = messages.filter(m => m.role === 'assistant');

        // Build a simple keyword-based summary
        const allUserText = userMsgs.map(m => m.content).join(' ');
        const keywords = [];

        const LOAN_TYPES = ['home loan', 'personal loan', 'car loan', 'business loan', 'gold loan', 'education loan'];
        LOAN_TYPES.forEach(lt => {
            if (allUserText.toLowerCase().includes(lt)) keywords.push(lt);
        });

        const summary = `Customer (${phone}) had ${conversations.length} conversation(s) with ${userMsgs.length} message(s). ` +
            (keywords.length ? `Enquired about: ${keywords.join(', ')}. ` : '') +
            `Bot replied ${botMsgs.length} time(s). ` +
            `Last message: "${userMsgs.slice(-1)[0]?.content?.slice(0, 80) || '—'}"`;

        res.json({
            success: true,
            data: {
                phoneNumber: phone,
                summary,
                totalMessages:      messages.length,
                userMessages:       userMsgs.length,
                botMessages:        botMsgs.length,
                conversations:      conversations.length,
                detectedTopics:     keywords,
                lastMessage:        userMsgs.slice(-1)[0]?.content || null,
                lastMessageAt:      userMsgs.slice(-1)[0]?.timestamp || null
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
