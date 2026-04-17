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
You are a precise data extraction assistant for a loan company chatbot.
Your task is to extract loan-related information from the user's message and return it in a strict JSON format.

FIELDS TO EXTRACT (If mentioned):
- intent: (new_loan, balance_transfer, cancel)
- isBalanceTransfer: (true/false)
- existingLoanBank: Bank name for existing loan
- emisCompleted: Number of EMIs completed
- clientName: Client's actual name ONLY
- city: City name
- cityArea: Area in the city
- age: Age in years (number)
- totalYearsInJob: Number of years in current/total job
- loanType: Specific loan product requirement (e.g., Home Loan, Personal Loan, etc.)

- loanAmount: Loan amount in rupees (number)
- cibilScore: Credit score or history (Good, Average, Poor, Nil, Don’t know)
- cibilIssueDetail: Explanation of CIBIL issues
- profession: The user's job or business status (e.g., Salaried, Businessman, Teacher, Doctor, etc.)
- companyName: Name of the company they work for (Salaried)
- netSalary: Net salary amount (Salaried)
- grossSalary: Gross salary amount (Salaried)
- salaryMode: (bank, cash, etc.)
- existingEmiAmount: Amount of existing EMI
- otherIncomeDetail: Any other income mentioned
- coApplicantIncomeDetail: Any co-applicant income mentioned
- companyType: (Proprietor, Partnership, Pvt Ltd, etc.)
- businessType: (Manufacturing, Trading, Service, etc.)
- businessVintageYears: Age of the business
- monthlyAnnualIncome: Income for self employed/business
- itrYears: Number of years IT returns filed
- hasGstNumber: (true/false)
- hasCurrentAccount: (true/false)
- professionalType: (Doctor, lawyer, Teacher, CA, etc.)
- propertyFinalized: (true/false)
- propertyType: (Under construction, Ready possession, Resale, etc.)
- propertyValue: Property value amount
- saleDeedAmount: Sale deed value
- timeToFinalizeProperty: Time constraint for property
- preSanctionRequired: (true/false)
- loanPurpose: Purpose of the loan
- propertyNature: (residential, commercial, Industrial, Plot, etc.)
- isSelfOccupied: (true/false)
- propertyOwnership: (own name, joint, etc.)
- currentBank: Existing bank for balance transfer
- currentInterestRate: Existing interest rate
- loanStartDate: Start date of current loan
- outstandingAmount: Outstanding loan amount
- currentEmi: Current EMI being paid
- missedEmiLast12Months: (true/false)
- balanceTransferGoal: (Lower EMI, lower interest, top-up loan)
- topUpRequired: (true/false)
- topUpAmount: Requested top-up
- isBusinessRegistered: (true/false)
- businessTurnover: Business turnover amount
- businessNetProfit: Net profit amount
- isMsmeRegistered: (true/false)
- loanSecurityType: (unsecured, secured)
- offeredSecurity: Available security
- whenLoanRequired: Timeframe needed
- loanPriority: (maximum loan amount, lower EMI, quick disbursal, lowest interest rate)
- propertyLocation: Location of property
- annualProfit: Yearly profit for business
- yearlyEarnings: Yearly earnings for profession

RULES:
1. Return ONLY valid JSON strings map.
2. If a field is not mentioned do not include it.
3. Extract boolean answers as boolean type, and amount answers as numbers.
4. Normalize typos (e.g., "Home lone" -> "Home Loan").
5. CRITICAL: For loan amounts, accurately convert words to numbers.
   - "5 lac", "5 lakh", "5 lack", "5 L" = 500000
   - "20 lac", "20 lakh", "20 L" = 2000000
   - Handle typos like "lack", "lakhs", "lak", "lac" and convert them to full numeric values (e.g., 500000) for the loanAmount field.
6. Return ONLY the JSON object.`;

        const cleanedEnquiry = currentEnquiry && typeof currentEnquiry.toObject === 'function' 
            ? currentEnquiry.toObject() 
            : currentEnquiry;

        const requestPayload = {
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: systemPrompt },
                { 
                    role: "user", 
                    content: `Current Collected Data: ${JSON.stringify(cleanedEnquiry)}\n\nNew User Message: "${text}"\n\nExtract any new or updated information from the message above.` 
                }
            ],
            temperature: 0.1,
            max_tokens: 1024,
            response_format: { type: "json_object" }
        };

        console.log("🚀 [AI_REQUEST] Calling Groq API...");
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

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content) {
            console.log("⚠️ [AI_EMPTY] No content in response.");
            return {};
        }

        try {
            const parsed = JSON.parse(content);
            console.log("💎 [AI_DATA] Extracted:", JSON.stringify(parsed));
            return parsed;
        } catch (jsonError) {
            console.error("❌ [AI_PARSE_ERROR]", jsonError.message);
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