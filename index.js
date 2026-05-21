require("dotenv").config();
const express = require("express");
const axios   = require("axios");
const cors    = require("cors");

const connectDB           = require("./config/database");
const dashboardRoutes     = require("./routes/dashboard");
const adminRoutes         = require("./routes/admin.js");
const enquiriesRoutes     = require("./routes/enquiries.js");
const handoverRoutes      = require("./routes/handover.js");
const analyticsRoutes     = require("./routes/analytics.js");
const templatesRoutes     = require("./routes/templates.js");
const broadcastRoutes     = require("./routes/broadcast.js");
const botConfigRoutes     = require("./routes/botConfig.js");

const { saveContact, saveConversation, estimateTokens } = require("./functions/conversationHelper");
const {
  getOrCreateEnquiry,
  upsertEnquiryFromMessage,
  createCallbackRequest,
  updateEnquiryData,
  resetEnquiry
} = require("./functions/loanEnquiryHelper");
const { generateSystemPrompt } = require("./functions/systemPromptGenerator");
const { isUserDisinterested }  = require("./functions/responseParser");

// ── Models needed in webhook ──────────────────────────
const Conversation = require("./models/Conversation");
const Handover     = require("./models/Handover");
const Campaign     = require("./models/Campaign");
const BotConfig    = require("./models/BotConfig");

const app = express();
connectDB();

app.use(cors());
app.use(express.json());

const {
  VERIFY_TOKEN,
  WHATSAPP_TOKEN,
  PHONE_NUMBER_ID,
  GROQ_API_KEY
} = process.env;

// ── Root ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send(`<html><head><title>Zatpat Loans Bot</title></head>
  <body style="font-family:Inter,sans-serif;padding:40px;background:#f8fafc;color:#1e293b;">
    <h1>🚀 Zatpat Loans WhatsApp Bot</h1>
    <p>Server running. Webhook active.</p>
    <ul>
      <li>Dashboard API: <code>/api1/dashboard</code></li>
      <li>Handover API:  <code>/api1/handover</code></li>
      <li>Analytics API: <code>/api1/analytics</code></li>
      <li>Templates API: <code>/api1/templates</code></li>
      <li>Broadcast API: <code>/api1/broadcast</code></li>
    </ul>
  </body></html>`);
});

// ── Route registration ────────────────────────────────
app.use("/api1/dashboard",   dashboardRoutes);
app.use("/api1/admin",       adminRoutes);
app.use("/api1/enquiries",   enquiriesRoutes);
app.use("/api1/handover",    handoverRoutes);
app.use("/api1/analytics",   analyticsRoutes);
app.use("/api1/templates",   templatesRoutes);
app.use("/api1/broadcast",   broadcastRoutes);
app.use("/api1/bot-config",  botConfigRoutes);

// ── Privacy Policy ────────────────────────────────────
app.get("/privacy-policy", (req, res) => {
  res.send(`<html><head><title>Privacy Policy</title></head>
  <body style="font-family:Arial;padding:20px;">
    <h1>Privacy Policy</h1>
    <p>This application uses the WhatsApp Cloud API to receive and respond to messages.</p>
    <p>We do not store, sell, or share personal data. Messages are processed only for automated replies using AI.</p>
    <p>Contact: <strong>parmarkrishdevloper@gmail.com</strong></p>
  </body></html>`);
});

// ── WhatsApp Webhook verification ─────────────────────
app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ── sendWhatsAppMessage helper ────────────────────────
async function sendWhatsAppMessage(to, body, token, phoneId) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// ── Main WhatsApp Webhook ─────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    console.log("📩 [WEBHOOK] Incoming message");
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    // Skip delivery status updates
    if (value?.statuses) return;

    const message = value?.messages?.[0];
    if (!message || message.type !== "text") return;

    const from     = message.from;
    const userText = message.text?.body;
    if (!userText) return;

    // ── 1. Check Human Handover ───────────────────────
    // If a human agent has taken over this chat, skip bot reply
    const handoverRecord = await Handover.findOne({ phoneNumber: from });
    if (handoverRecord && handoverRecord.controller === "human") {
      console.log(`🤝 [HANDOVER] ${from} is under human control — bot skipping`);
      // Still save the incoming message to conversation for agent visibility
      try {
        await saveContact(from);
        await saveConversation(from, userText, null, estimateTokens(userText), 0);
      } catch (dbErr) {
        console.error("DB save error (handover):", dbErr.message);
      }
      return;
    }

    // ── 2. Track campaign replies ─────────────────────
    // Check if this number is in a recently sent campaign (last 7 days)
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const activeCampaign = await Campaign.findOne({
        status: { $in: ["sending", "completed"] },
        startedAt: { $gte: sevenDaysAgo },
        recipients: from,
        repliedNumbers: { $ne: from } // not already counted
      });

      if (activeCampaign) {
        await Campaign.findByIdAndUpdate(activeCampaign._id, {
          $inc: { replies: 1 },
          $addToSet: { repliedNumbers: from }
        });
        console.log(`📊 [CAMPAIGN] Reply tracked for campaign "${activeCampaign.name}" from ${from}`);
      }
    } catch (campaignErr) {
      console.error("Campaign reply tracking error:", campaignErr.message);
    }

    // ── 3. Normal bot flow ────────────────────────────
    let enquiry = await getOrCreateEnquiry(from);

    // Load recent conversation history
    let conversationHistory = [];
    try {
      const recentConversation = await Conversation.findOne({ phoneNumber: from }).sort({ createdAt: -1 });
      if (recentConversation?.messages?.length) {
        conversationHistory = recentConversation.messages.slice(-15).map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      }
    } catch (historyError) {
      console.error("Conversation history error:", historyError.message);
    }

    const upsertResult = await upsertEnquiryFromMessage(from, userText);
    enquiry = upsertResult.enquiry;

    if (upsertResult.isReset) {
      console.log(`🔄 [RESET] Enquiry reset for ${from}`);
    }

    // Auto-reset on greeting if callback was already requested
    const isGreeting = /^(hi|hello|hey|greetings|namaste|hola)/i.test(userText.trim());
    if (isGreeting && enquiry.status === "in_progress" && enquiry.callbackRequested) {
      console.log(`🔄 [AUTO-RESET] Greeting from ${from} — resetting for new loan flow`);
      await resetEnquiry(from);
    }

    // User disinterested — send goodbye, request callback
    if (isUserDisinterested(userText, conversationHistory)) {
      const goodbyeMessage = "No problem. Our loan executive will reach out to you very soon. Thank you!";
      await createCallbackRequest(from, "ASAP");

      try {
        await saveContact(from);
        await saveConversation(from, userText, goodbyeMessage, estimateTokens(userText), estimateTokens(goodbyeMessage));
      } catch (dbError) {
        console.error("Database save error:", dbError.message);
      }

      await sendWhatsAppMessage(from, goodbyeMessage, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      return;
    }

    // All primary fields collected — transition to review
    if (upsertResult.hasAllPrimaryFields) {
      await updateEnquiryData(from, "review", {});
      const finalMessage = `🎉 Thank you!\nWe are checking the best loan options for you.\nOur loan executive will contact you shortly.\n\n👉 *Options:*\n1️⃣ Call me now\n2️⃣ Send details on WhatsApp`;

      try {
        await saveContact(from);
        await saveConversation(from, userText, finalMessage, estimateTokens(userText), estimateTokens(finalMessage));
      } catch (dbError) {
        console.error("Database save error:", dbError.message);
      }

      await sendWhatsAppMessage(from, finalMessage, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      return;
    }

    // AI-powered reply via Groq
    // ── Load system prompt from DB (admin-editable) ────
    const stageForPrompt = enquiry.conversationStage || "loan_type";
    let systemPrompt;
    try {
      const loanTypeLower = (enquiry.loanType || "").toLowerCase();

      // Try to match a specific flow by triggerKeywords
      let flowDoc = null;
      if (loanTypeLower) {
        flowDoc = await BotConfig.findOne({
          isActive: true,
          flowKey: { $ne: "default" },
          triggerKeywords: { $elemMatch: { $regex: loanTypeLower, $options: "i" } }
        });
      }

      // Fall back to default flow
      if (!flowDoc) {
        flowDoc = await BotConfig.findOne({ flowKey: "default", isActive: true });
      }

      if (flowDoc) {
        // Replace {{name}} and {{context}} placeholders
        const { generateConversationContext } = require("./functions/systemPromptGenerator");
        const context = generateConversationContext(enquiry.toJSON(), stageForPrompt);
        systemPrompt = flowDoc.systemPrompt
          .replace(/\{\{name\}\}/g, enquiry.clientName || "")
          .replace(/\{\{context\}\}/g, context);
      } else {
        // Absolute fallback — use hardcoded generator
        systemPrompt = generateSystemPrompt(stageForPrompt, enquiry.toJSON());
      }
    } catch (configErr) {
      console.error("[BotConfig] DB lookup failed, using hardcoded prompt:", configErr.message);
      systemPrompt = generateSystemPrompt(stageForPrompt, enquiry.toJSON());
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userText }
    ];

    const aiResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.5,
        max_tokens: 300
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const replyText    = aiResponse.data?.choices?.[0]?.message?.content || "Thanks. Our loan specialist will call you shortly.";
    const usage        = aiResponse.data.usage || {};
    const inputTokens  = usage.prompt_tokens      || estimateTokens(userText);
    const outputTokens = usage.completion_tokens  || estimateTokens(replyText);

    try {
      await saveContact(from);
      await saveConversation(from, userText, replyText, inputTokens, outputTokens);
    } catch (dbError) {
      console.error("Database save error:", dbError.message);
    }

    await sendWhatsAppMessage(from, replyText, WHATSAPP_TOKEN, PHONE_NUMBER_ID);

  } catch (error) {
    console.error("❌ WEBHOOK ERROR:", error.response?.data || error.message);
    if (error.stack) console.error("Stack:", error.stack);
  }
});

// ── Start server ──────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 [ZATPAT_BOT] Version: 3.0 — All features active`);
  console.log(`🚀 [ZATPAT_BOT] Server running on port ${PORT}`);
  console.log(`🚀 [ZATPAT_BOT] Started: ${new Date().toLocaleString()}`);
  console.log(`✅ Features: Webhook · Dashboard · Handover · Analytics · Templates · Broadcast`);
});