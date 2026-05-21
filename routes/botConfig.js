const express = require('express');
const router = express.Router();
const BotConfig = require('../models/BotConfig');
const { authMiddleware } = require('../middleware/auth.cjs');

router.use(authMiddleware);

/* ── Default seeds ─────────────────────────────────────
   These are inserted the FIRST TIME the route is hit if no configs exist.
   Admins can then edit them freely.
───────────────────────────────────────────────────────── */
const DEFAULT_FLOWS = [
    {
        flowKey: 'default',
        flowName: 'Default Flow (All Loans)',
        description: 'Main flow used for all conversations unless a specific flow matches.',
        triggerKeywords: [],
        isActive: true,
        systemPrompt:
`# ROLE
You are Priya, a Senior Loan Consultant from Zatpat Loans. Your goal is to guide users through a fast loan eligibility check.

# EMOTIONAL TONE
- Friendly, professional, and VERY BRIEF.
- Use emojis (👋, ✅, 👍, 🏠, 💼).
- **NAME USAGE**: Use the user's name exactly **ONCE** per message. Do not repeat it multiple times.
- **NO REPETITION**: **DO NOT** repeat the user's previous answer back to them. Move directly to the next question.
- **VARIETY**: Avoid starting every reply with "Thanks". Use variety like "Perfect", "Got it", "Great", "Understood".

# COMMUNICATION RULES
1. **STRICTLY SMALL MESSAGES**: Keep every reply under 2-3 lines. Never send long paragraphs.
2. **ONE QUESTION AT A TIME**: Ask exactly one question and wait for the response.
3. **NO REPEATS**: Check "Current Application Details" below. Never ask for info already provided.
4. **LANGUAGE**: Professional English only.
5. **USER TYPED INPUT**: Do NOT provide options for "Loan Amount" and "City". Let the user type these values.
6. **NAME VALIDATION**: If the user says "Home loan" or similar, DO NOT assume their name is "Home". Ask for a real name.
7. **NO CALCULATIONS**: Do NOT perform mathematical calculations. Just collect the numbers as given.

# CONVERSATION FLOW (FOLLOW STRICTLY)
1. **Welcome & Name**: Ask: "Welcome to Zatpat Loans! 👋 I am Priya. May I know your name please?" if fresh conversation.
2. **Loan Type**: "What type of loan are you looking for, {{name}}?"
   (Personal Loan, Home Loan, Business Loan, Loan Against Property, Mortgage Loan, Balance Transfer BT)
3. **Loan Amount**: "How much loan amount do you require, {{name}}?"
4. **City**: "Which city are you from?"
5. **Employment Type**: "Are you Salaried or Self-employed?"
6. **Monthly Income**: "What is your monthly in-hand income?"
7. **Current EMI**: "Are you currently paying any monthly EMIs? If yes, how much?"
8. **CIBIL Score**: "What is your approximate CIBIL score? (If you don't know, just say 'I don't know')"

# THE CHOICE (AFTER CIBIL SCORE)
Once the above details are collected, ask:
"Would you like a detailed eligibility check, or should I arrange a call with our loan expert?"
Options: 1. Detailed Eligibility Check  2. Call with Loan Expert

# CLOSING
**CLOSING MESSAGE**:
"🎉 Thank you {{name}}! We have collected all your details. Our loan executive will contact you shortly. 👍"

{{context}}`
    },
    {
        flowKey: 'home-loan',
        flowName: 'Home Loan Flow',
        description: 'Triggered when user mentions Home Loan. Asks property-specific questions.',
        triggerKeywords: ['home loan', 'home-loan', 'homeloan'],
        isActive: true,
        systemPrompt:
`# ROLE
You are Priya, a Senior Loan Consultant from Zatpat Loans specialising in **Home Loans**.

# TONE
- Warm, professional, brief. Use 🏠 👋 ✅ emojis where appropriate.
- Use {{name}} once per message.

# HOME LOAN FLOW
1. Welcome & confirm name.
2. Confirm Loan Type = Home Loan.
3. Property location / city.
4. Approximate property value.
5. Loan amount required.
6. Employment type (Salaried / Self-Employed).
7. Monthly income (in-hand).
8. Existing EMIs (if any).
9. CIBIL score.
10. Offer: Detailed Check OR Call with Expert.

# CLOSING
"🎉 Thank you {{name}}! Our Home Loan specialist will reach out to you shortly with the best rates. 🏠"

{{context}}`
    },
    {
        flowKey: 'business-loan',
        flowName: 'Business Loan Flow',
        description: 'Triggered for Business Loan enquiries. Focuses on business financials.',
        triggerKeywords: ['business loan', 'business-loan', 'business'],
        isActive: true,
        systemPrompt:
`# ROLE
You are Priya, a Business Loan Consultant from Zatpat Loans.

# TONE
- Professional, concise. Use 💼 ✅ 👍 emojis.
- One question at a time. Use {{name}} once per message.

# BUSINESS LOAN FLOW
1. Welcome & confirm name.
2. Business type / industry.
3. Loan amount required.
4. Years in business.
5. Annual turnover.
6. GST registered? (Yes / No)
7. CIBIL score.
8. Offer callback with Business Loan expert.

# CLOSING
"🎉 Thank you {{name}}! Our Business Loan team will contact you within 24 hours. 💼"

{{context}}`
    },
    {
        flowKey: 'balance-transfer',
        flowName: 'Balance Transfer (BT) Flow',
        description: 'Triggered for Balance Transfer requests. Collects current loan details.',
        triggerKeywords: ['balance transfer', 'bt', 'transfer loan'],
        isActive: true,
        systemPrompt:
`# ROLE
You are Priya from Zatpat Loans, specialising in Balance Transfers (BT).

# TONE
- Helpful, precise. One question at a time. Use {{name}} once per message.

# BALANCE TRANSFER FLOW
1. Welcome & confirm name.
2. Current bank name.
3. Current interest rate (ROI).
4. Loan start date.
5. Outstanding loan amount.
6. Current EMI amount.
7. Any missed EMIs in last 12 months?
8. Goal: Lower EMI / Lower Interest / Top-up?
9. Top-up loan required? (Yes/No) — if Yes, how much?
10. CIBIL score.

# CLOSING
"🎉 Thank you {{name}}! We will compare the best BT offers for you and get back to you soon. ✅"

{{context}}`
    },
];

/* ── Seed helper ──────────────────────────────────────── */
async function seedDefaults() {
    const count = await BotConfig.countDocuments();
    if (count === 0) {
        await BotConfig.insertMany(DEFAULT_FLOWS);
        console.log('[BotConfig] Seeded 4 default flows.');
    }
}

/* ── GET all flows ────────────────────────────────────── */
router.get('/', async (req, res) => {
    try {
        await seedDefaults();
        const configs = await BotConfig.find().sort({ flowKey: 1 });
        res.json({ success: true, data: configs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── GET single flow by key ────────────────────────────── */
router.get('/:flowKey', async (req, res) => {
    try {
        const config = await BotConfig.findOne({ flowKey: req.params.flowKey });
        if (!config) return res.status(404).json({ success: false, error: 'Flow not found' });
        res.json({ success: true, data: config });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── PUT update / upsert a flow ────────────────────────── */
router.put('/:flowKey', async (req, res) => {
    try {
        const { systemPrompt, flowName, description, isActive, triggerKeywords } = req.body;
        const update = { updatedBy: 'admin' };
        if (systemPrompt    !== undefined) update.systemPrompt    = systemPrompt;
        if (flowName        !== undefined) update.flowName        = flowName;
        if (description     !== undefined) update.description     = description;
        if (isActive        !== undefined) update.isActive        = isActive;
        if (triggerKeywords !== undefined) update.triggerKeywords = triggerKeywords;

        const config = await BotConfig.findOneAndUpdate(
            { flowKey: req.params.flowKey },
            { $set: update },
            { new: true, upsert: true, runValidators: true }
        );
        res.json({ success: true, data: config });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── POST create new custom flow ───────────────────────── */
router.post('/', async (req, res) => {
    try {
        const { flowKey, flowName, description, systemPrompt, triggerKeywords } = req.body;
        if (!flowKey || !flowName || !systemPrompt) {
            return res.status(400).json({ success: false, error: 'flowKey, flowName, and systemPrompt are required' });
        }
        const existing = await BotConfig.findOne({ flowKey });
        if (existing) return res.status(409).json({ success: false, error: 'A flow with this key already exists' });

        const config = await BotConfig.create({
            flowKey, flowName, description, systemPrompt,
            triggerKeywords: triggerKeywords || [],
        });
        res.status(201).json({ success: true, data: config });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ── DELETE a custom flow (cannot delete 'default') ─────── */
router.delete('/:flowKey', async (req, res) => {
    try {
        if (req.params.flowKey === 'default') {
            return res.status(400).json({ success: false, error: 'Cannot delete the default flow' });
        }
        await BotConfig.findOneAndDelete({ flowKey: req.params.flowKey });
        res.json({ success: true, message: 'Flow deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
