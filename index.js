require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const connectDB = require("./config/database");
const dashboardRoutes = require("./routes/dashboard");
const { saveContact, saveConversation, estimateTokens } = require("./functions/conversationHelper");
const adminRoutes = require("./routes/admin.js");
const enquiriesRoutes = require("./routes/enquiries.js");
const {
  getOrCreateEnquiry,
  upsertEnquiryFromMessage,
  createCallbackRequest,
  updateEnquiryData,
  getEnquirySummary // Import summary helper
} = require("./functions/loanEnquiryHelper");
const { generateSystemPrompt, generateConversationContext } = require("./functions/systemPromptGenerator");
const { isUserDisinterested } = require("./functions/responseParser");

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

app.get("/", (req, res) => {
  res.send("WhatsApp Loan Bot is running");
});

app.use("/api1/dashboard", dashboardRoutes);
app.use("/api1/admin", adminRoutes);
app.use("/api1/enquiries", enquiriesRoutes);

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

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

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    console.log("this function is running")
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.statuses) {
      return;
    }

    const message = value?.messages?.[0];
    if (!message || message.type !== "text") {
      return;
    }

    const from = message.from;
    const userText = message.text?.body;
    if (!userText) {
      return;
    }

    let enquiry = await getOrCreateEnquiry(from);

    let conversationHistory = [];
    try {
      const Conversation = require("./models/Conversation");
      const recentConversation = await Conversation.findOne({ phoneNumber: from }).sort({ createdAt: -1 });
      if (recentConversation?.messages?.length) {
        conversationHistory = recentConversation.messages.slice(-5).map((msg) => ({
          role: msg.role,
          content: msg.content
        }));
      }
    } catch (historyError) {
      console.error("Conversation history error:", historyError.message);
    }

    const upsertResult = await upsertEnquiryFromMessage(from, userText);
    enquiry = upsertResult.enquiry;

    // 1. Handle explicit reset (User said "New Loan")
    if (upsertResult.isReset) {
      let resetMsg = "Okay, I've started a new loan application for you. What type of loan are you looking for?";

      // If it was a SMART reset (we already captured new data like "Personal loan"), customize the message
      if (upsertResult.isSmartReset && enquiry.loanType) {
        resetMsg = `Great! I've noted you're applying for a ${enquiry.loanType} loan. How much loan amount are you looking for?`;
      }

      await sendWhatsAppMessage(from, resetMsg, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      // Save conversation state for this message
      try {
        await saveContact(from);
        await saveConversation(from, userText, resetMsg, estimateTokens(userText), estimateTokens(resetMsg));
      } catch (dbError) { console.error(dbError); }
      return;
    }

    // 2. Handle Greeting with Existing Completed Enquiry
    const isGreeting = /^(hi|hello|hey|greetings|namaste|hola)/i.test(userText.trim());

    // STRICT CHECK: Only show "Welcome Back" if we actually have useful data (Loan type/Amount)
    const hasUsefulData = enquiry.loanType || enquiry.loanAmount;

    if (isGreeting && enquiry.status === 'in_progress' && enquiry.callbackRequested && hasUsefulData) {
      const summary = getEnquirySummary(enquiry);
      const welcomeBackMsg = `Welcome back! We have your previous loan application: ${summary}.\n\nDo you want to continue with this or apply for a *new loan*?`;

      await sendWhatsAppMessage(from, welcomeBackMsg, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      try {
        await saveContact(from);
        await saveConversation(from, userText, welcomeBackMsg, estimateTokens(userText), estimateTokens(welcomeBackMsg));
      } catch (dbError) { console.error(dbError); }
      return;
    }

    if (isUserDisinterested(userText, conversationHistory)) {
      const goodbyeMessage = "No problem. Our loan specialist will reach out to you very soon. Thank you!";
      await createCallbackRequest(from, "ASAP");

      try {
        await saveContact(from);
        await saveConversation(
          from,
          userText,
          goodbyeMessage,
          estimateTokens(userText),
          estimateTokens(goodbyeMessage)
        );
      } catch (dbError) {
        console.error("Database save error:", dbError.message);
      }

      await sendWhatsAppMessage(from, goodbyeMessage, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      return;
    }

    if (upsertResult.hasAllPrimaryFields) {
      await updateEnquiryData(from, "review", {});
      // Fix "Thank you null" -> Use valid name or generic fallback
      const namePart = enquiry.clientName && enquiry.clientName !== 'null' ? ` ${enquiry.clientName}` : "";
      const finalMessage = `Thank you${namePart}. Our loan specialist will call you back shortly.`;

      try {
        await saveContact(from);
        await saveConversation(
          from,
          userText,
          finalMessage,
          estimateTokens(userText),
          estimateTokens(finalMessage)
        );
      } catch (dbError) {
        console.error("Database save error:", dbError.message);
      }

      await sendWhatsAppMessage(from, finalMessage, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
      return;
    }

    const stageForPrompt = enquiry.conversationStage || "loan_type";
    const systemPrompt = generateSystemPrompt(stageForPrompt, enquiry.toJSON());
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

    const replyText = aiResponse.data?.choices?.[0]?.message?.content || "Thanks. Our loan specialist will call you shortly.";
    const usage = aiResponse.data.usage || {};
    const inputTokens = usage.prompt_tokens || estimateTokens(userText);
    const outputTokens = usage.completion_tokens || estimateTokens(replyText);

    try {
      await saveContact(from);
      await saveConversation(from, userText, replyText, inputTokens, outputTokens);
    } catch (dbError) {
      console.error("Database save error:", dbError.message);
    }

    await sendWhatsAppMessage(from, replyText, WHATSAPP_TOKEN, PHONE_NUMBER_ID);
  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
  }
});

app.get("/privacy-policy", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Privacy Policy</title>
      </head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>Privacy Policy</h1>

        <p>
          This application uses the WhatsApp Cloud API to receive and respond
          to messages sent by users.
        </p>

        <p>
          We do not store, sell, or share personal data.
          Messages are processed only for automated replies using AI.
        </p>

        <p>
          If you have any questions, contact us at:
          <strong>parmarkrishdevloper@gmail.com</strong>
        </p>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 [ZATPAT_BOT] Version: 2.0.debug_v3`);
    console.log(`🚀 [ZATPAT_BOT] Server running on port ${PORT}`);
    console.log(`🚀 [ZATPAT_BOT] Last Deployment: ${new Date().toLocaleString()}`);
});