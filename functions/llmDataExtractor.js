const axios = require('axios');
require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Extract structured loan data from user message using LLM
 * @param {string} text - User's message text
 * @param {object} currentEnquiry - Current enquiry state (optional context for better extraction)
 * @returns {object} - Extracted data object
 */
async function extractDataWithAI(text, currentEnquiry = {}) {
    const phoneNumber = currentEnquiry.phoneNumber || "Unknown";
    console.log(`\n--- 📥 [AI_START] Processing message from ${phoneNumber} ---`);
    try {
                const systemPrompt = `
You are a precise and intelligent data extraction assistant for a loan company chatbot.
Your task is to extract structured loan-related information from the user's message and return it in STRICT JSON format.

-----------------------------------
🎯 OBJECTIVE
-----------------------------------
- Extract ONLY explicitly mentioned details.
- Normalize and standardize values.
- Do NOT assume missing data.
- Output must ALWAYS be valid JSON.

-----------------------------------
📌 OUTPUT RULES
-----------------------------------
1. Return ONLY a valid JSON object.
2. Do NOT add explanations, text, or comments.
3. Do NOT include fields that are not mentioned.
4. Use correct data types:
   - Boolean → true / false
   - Numbers → numeric (no strings, no commas)
5. Normalize spelling mistakes and typos.
6. Convert all monetary values into absolute numbers in rupees.

-----------------------------------
💰 LOAN AMOUNT NORMALIZATION RULE
-----------------------------------
Convert all variations into numeric values:
- "5 lakh", "5 lac", "5 L", "5 lack", "5 lakhs" → 500000
- "20 lakh", "20 L" → 2000000
- "1 crore" → 10000000
Handle typos and variations intelligently.

-----------------------------------
🧠 INTENT DETECTION RULE
-----------------------------------
Detect intent based on user message:
- "new loan", "apply loan" → "new_loan"
- "transfer loan", "lower interest", "BT" → "balance_transfer"
- "cancel loan", "close loan" → "cancel"

If balance transfer → set:
"isBalanceTransfer": true

-----------------------------------
📊 FIELDS TO EXTRACT
-----------------------------------

BASIC:
- intent
- loanType
- loanAmount
- loanPurpose

PERSONAL:
- clientName (ONLY actual name, no titles like "Mr.", "I am")
- age
- city
- cityArea

CREDIT:
- cibilScore → (Good, Average, Poor, Nil, Don’t know)
- cibilIssueDetail

EMPLOYMENT:
- profession → (Salaried, Businessman, Self-Employed, Doctor, etc.)
- companyName
- totalYearsInJob

SALARY (SALARIED):
- netSalary
- grossSalary
- salaryMode → (bank, cash)

BUSINESS:
- companyType → (Proprietor, Partnership, Pvt Ltd)
- businessType → (Manufacturing, Trading, Service)
- businessVintageYears
- monthlyAnnualIncome
- itrYears
- hasGstNumber → true/false
- hasCurrentAccount → true/false
- isBusinessRegistered → true/false
- businessTurnover
- businessNetProfit
- annualProfit

LOAN DETAILS:
- existingLoanBank
- existingEmiAmount
- emisCompleted

BALANCE TRANSFER:
- currentBank
- currentInterestRate
- loanStartDate
- outstandingAmount
- currentEmi
- missedEmiLast12Months → true/false
- balanceTransferGoal → (Lower EMI, lower interest, top-up loan)
- topUpRequired → true/false
- topUpAmount

PROPERTY:
- propertyFinalized → true/false
- propertyType → (Under construction, Ready possession, Resale)
- propertyValue
- saleDeedAmount
- propertyNature → (residential, commercial, industrial, plot)
- propertyLocation
- isSelfOccupied → true/false
- propertyOwnership → (own name, joint, etc.)
- timeToFinalizeProperty
- preSanctionRequired → true/false

INCOME ADDITIONAL:
- otherIncomeDetail
- coApplicantIncomeDetail
- yearlyEarnings

LOAN PREFERENCES:
- loanPriority → (maximum loan amount, lower EMI, quick disbursal, lowest interest rate)
- whenLoanRequired

SECURITY:
- loanSecurityType → (secured, unsecured)
- offeredSecurity

-----------------------------------
⚠️ SPECIAL HANDLING RULES
-----------------------------------
1. If user mentions:
   - "salary in cash" → salaryMode = "cash"
   - "bank salary" → salaryMode = "bank"

2. If EMI missed:
   - "missed EMI", "bounce", "late payment" → missedEmiLast12Months = true

3. If no CIBIL:
   - "no score", "-1", "no history" → cibilScore = "Nil"

4. If unsure:
   - "don't know CIBIL" → cibilScore = "Don’t know"

5. Extract clean names only:
   - "My name is Krish Patel" → "Krish Patel"

-----------------------------------
🚫 DO NOT DO
-----------------------------------
- Extract ONLY explicitly mentioned details from the NEW User Message.
- Normalize and standardize values.
- Do NOT assume missing data.
- Do NOT repeat information from the "Current Collected Data" unless it is being updated.
- Output must ALWAYS be valid JSON.
- CRITICAL: The "intent" field should ONLY be included if the user explicitly expresses a wish to start a new loan, transfer, or cancel in the CURRENT message. Do NOT include "intent" if the user is just confirming details (e.g., saying "yes", "correct", "ok").
- CRITICAL: Never extract common keywords like "loan", "new", "apply", "transfer", "bank", "rupees" as a clientName.
- If the user says "My name is X", extract "X". If they say "New loan", clientName should remain empty.
- Normalize clientName: "I am Krish" -> "Krish".
`;

        const cleanedEnquiry = currentEnquiry && typeof currentEnquiry.toObject === 'function' 
            ? currentEnquiry.toObject() 
            : currentEnquiry;

        const requestPayload = {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { 
                    role: "user", 
                    content: `Current Collected Data: ${JSON.stringify(cleanedEnquiry)}\n\nNew User Message: "${text}"\n\nExtract any new or updated information from the message above accurately.` 
                }
            ],
            temperature: 0.1,
            max_tokens: 1024,
            response_format: { type: "json_object" }
        };

        console.log("🚀 [AI_REQUEST] Calling Groq API with Llama 3.3 70B...");
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            requestPayload,
            {
                headers: {
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("✅ [AI_SUCCESS] Groq Response Received (Status: " + response.status + ")");

        let content = response.data?.choices?.[0]?.message?.content;
        if (!content) {
            console.log("⚠️ [AI_EMPTY] No content in response.");
            return {};
        }

        // Clean content if it contains markdown triple backticks
        if (content.includes('```')) {
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        try {
            const parsed = JSON.parse(content);
            
            // Post-extraction rule: If intent is balance_transfer, ensure isBalanceTransfer is true
            if (parsed.intent === 'balance_transfer') {
                parsed.isBalanceTransfer = true;
            }

            console.log("💎 [AI_DATA] Extracted:", JSON.stringify(parsed));
            return parsed;
        } catch (jsonError) {
            console.error("❌ [AI_PARSE_ERROR]", jsonError.message);
            console.log("Raw content was:", content);
            return {};
        }

    } catch (error) {
        console.error("‼️ [AI_CRITICAL_FAILURE] ‼️");
        if (error.response) {
            console.error("👉 STATUS:", error.response.status);
            console.error("👉 DATA:", JSON.stringify(error.response.data));
            console.error("👉 HEADERS:", JSON.stringify(error.response.headers).substring(0, 100));
        } else {
            console.error("👉 MESSAGE:", error.message);
        }
        return {}; 
    }
}

module.exports = { extractDataWithAI };