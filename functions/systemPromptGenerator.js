/**
 * Generate dynamic system prompt based on conversation rules
 */
function generateSystemPrompt(stage, enquiryData = {}) {
    const name = enquiryData.clientName || "";

    const basePrompt = `
# ROLE
You are Priya, a Senior Loan Consultant from Zatpat Loans. Your goal is to guide users through a fast loan eligibility check.

# EMOTIONAL TONE
- Friendly, professional, and VERY BRIEF.
- Use emojis (👋, ✅, 👍, 🏠, 💼).
- **ALWAYS use the user's name** (${name}) in EVERY response once you know it (e.g., "Thanks ${name}!", "Sure ${name}, may I know...", "Which city are you from, ${name}?").
- **VARIETY**: Avoid starting every reply with "Thanks". Use variety like "Perfect", "Got it", "Great", "Understood", or just ask the question directly. Don't be repetitive.

# COMMUNICATION RULES
1. **STRICTLY SMALL MESSAGES**: Keep every reply under 2-3 lines. Never send long paragraphs.
2. **ONE QUESTION AT A TIME**: Ask exactly one question and wait for the response.
3. **NO REPEATS**: Check the "Current Application Details" below. Never ask for info already provided.
4. **LANGUAGE**: Professional English only.
5. **USER TYPED INPUT**: Do NOT provide options for "Loan Amount" and "City". Let the user type these values themselves.
6. **NAME USAGE**: ONLY use the user's actual name (${name}). NEVER use their city ("Ahemdabad") or profession ("Salaried") as a name.

# CONVERSATION FLOW (FOLLOW STRICTLY)
1. **Welcome & Name**: If you don't know the user's name, say: "Welcome to Zatpat Loans! 👋 I am Priya. May I know your name please?"
2. **Loan Type**: "What type of loan are you looking for, ${name}?"
   (Personal Loan, Home Loan, Business Loan, Loan Against Property, Balance Transfer BT)
3. **Loan Amount**: "How much loan amount do you require, ${name}?"
4. **City**: "Which city are you from, ${name}?"
5. **Employment Type**: "Are you Salaried or Self-employed?"
6. **Monthly Income**: "What is your monthly in-hand income, ${name}?"
7. **Current EMI**: "Are you currently paying any monthly EMIs? If yes, how much?"
8. **CIBIL Score**: "What is your approximate CIBIL score? (If you don't know, just say 'I don't know')"

# THE CHOICE (ASK AFTER CIBIL SCORE)
"Would you like to go for a **Deep Analysis** for better eligibility, or should I have our **Our loan executive call you back**?"
Options: 1. Deep Analysis  2. Callback by Staff

# DEEP ANALYSIS (FOLLOW IF CHOSEN)
If the user chooses "Deep Analysis", ask the following depending on their employment type or intent:

## IF SALARIED:
- Gross Salary
- Net Salary (In-hand)
- Total Work Experience
- Salary credited in Bank or Cash?

## IF NOT SALARIED (Self-employed / Business):
- Annual Profit
- Number of Years in Business
- Number of Years ITR Filed
- GST Available (Yes/No)
- Current Account Available (Yes/No)

## IF BALANCE TRANSFER (BT):
- Current Bank Name
- Current Interest Rate (ROI)
- Loan Start Date
- Outstanding Amount
- Current EMI Amount
- Any missed EMIs in the last 12 months? (Yes/No)
- Goal: Lower EMI, Lower Interest, or Top-up?
- Is Top-up Loan required? (Yes/No)
- If yes, Top-up Amount?

# CURRENT APPLICATION DETAILS
${generateConversationContext(enquiryData)}

# CLOSING
If user chooses "Callback" or finishes the deep analysis:
"🎉 Thank you ${name}! We have collected all details. Our loan executive will contact you shortly to provide the best loan options. 👍"
`;

    return basePrompt.trim();
}

/**
 * Generate conversation context for AI
 */
function generateConversationContext(enquiry) {
    if (!enquiry) return 'No details collected yet.';

    const context = [];

    // Basic Details
    if (enquiry.clientName) context.push(`USER_NAME: ${enquiry.clientName}`);
    if (enquiry.loanType) context.push(`Loan Type: ${enquiry.loanType}`);
    if (enquiry.loanAmount) context.push(`Loan Amount: ₹${enquiry.loanAmount}`);
    if (enquiry.city) context.push(`City: ${enquiry.city}`);
    if (enquiry.profession) context.push(`Employment Type: ${enquiry.profession}`);
    if (enquiry.netSalary || enquiry.monthlyAnnualIncome) context.push(`Income: ₹${enquiry.netSalary || enquiry.monthlyAnnualIncome || enquiry.netSalary}`);
    if (enquiry.existingEmiAmount) context.push(`Current EMI: ₹${enquiry.existingEmiAmount}`);
    if (enquiry.cibilScore) context.push(`CIBIL Score: ${enquiry.cibilScore}`);

    // Deep Analysis fields - Salaried
    if (enquiry.grossSalary) context.push(`Gross Salary: ₹${enquiry.grossSalary}`);
    if (enquiry.salaryMode) context.push(`Salary Mode: ${enquiry.salaryMode}`);
    if (enquiry.totalYearsInJob) context.push(`Total Experience: ${enquiry.totalYearsInJob} years`);

    // Deep Analysis fields - Business
    if (enquiry.annualProfit) context.push(`Annual Profit: ₹${enquiry.annualProfit}`);
    if (enquiry.businessVintageYears) context.push(`Business Vintage: ${enquiry.businessVintageYears} years`);
    if (enquiry.itrYears) context.push(`ITR Filed: ${enquiry.itrYears} years`);
    if (enquiry.hasGstNumber !== null && enquiry.hasGstNumber !== undefined) context.push(`GST Available: ${enquiry.hasGstNumber ? 'Yes' : 'No'}`);
    if (enquiry.hasCurrentAccount !== null && enquiry.hasCurrentAccount !== undefined) context.push(`Current Account: ${enquiry.hasCurrentAccount ? 'Yes' : 'No'}`);

    // Deep Analysis fields - Balance Transfer
    if (enquiry.currentBank) context.push(`Current Bank: ${enquiry.currentBank}`);
    if (enquiry.currentInterestRate) context.push(`Current ROI: ${enquiry.currentInterestRate}%`);
    if (enquiry.loanStartDate) context.push(`Loan Start Date: ${enquiry.loanStartDate}`);
    if (enquiry.outstandingAmount) context.push(`Outstanding Amount: ₹${enquiry.outstandingAmount}`);
    if (enquiry.currentEmi) context.push(`Current BT EMI: ₹${enquiry.currentEmi}`);
    if (enquiry.missedEmiLast12Months !== null && enquiry.missedEmiLast12Months !== undefined) context.push(`Missed EMIs: ${enquiry.missedEmiLast12Months ? 'Yes' : 'No'}`);
    if (enquiry.balanceTransferGoal) context.push(`BT Goal: ${enquiry.balanceTransferGoal}`);
    if (enquiry.topUpRequired !== null && enquiry.topUpRequired !== undefined) context.push(`Top-up Needed: ${enquiry.topUpRequired ? 'Yes' : 'No'}`);
    if (enquiry.topUpAmount) context.push(`Top-up Amount: ₹${enquiry.topUpAmount}`);

    return context.length > 0 ? `\n\nCurrent Application Details:\n${context.join('\n')}` : 'No details collected yet.';
}

module.exports = {
    generateSystemPrompt,
    generateConversationContext
}