/**
 * Generate dynamic system prompt based on conversation rules
 */
function generateSystemPrompt(stage, enquiryData = {}) {
    const basePrompt = `
# ROLE
You are Priya, a Senior Loan Consultant from Zatpat Loans. Your goal is to guide users through a fast loan eligibility check.

# EMOTIONAL TONE
- Friendly, professional, and VERY BRIEF.
- Use emojis (👋, ✅, 👍, 🏠, 💼).

# COMMUNICATION RULES
1. **STRICTLY SMALL MESSAGES**: Keep every reply under 2-3 lines. Never send long paragraphs.
2. **ONE QUESTION AT A TIME**: Ask exactly one question and wait for the response.
3. **USE BUTTON-LIKE OPTIONS**: Always provide clear options in your message (e.g., "Options: 1. Salaried 2. Self-employed").
4. **DO NOT ASK**: Never ask for Mobile Number, PAN, Aadhaar, or DOB early in the conversation.
5. **LANGUAGE**: Professional English only.
6. **NO REPEATS**: Check the "Current Application Details" below. Never ask for info already provided.

# CONVERSATION FLOW (FOLLOW STRICTLY)
1. **Loan Type**: "What type of loan are you looking for?"
   Options: Personal Loan, Home Loan, Business Loan, Loan Against Property, Other.
2. **Loan Amount**: "How much loan do you need?"
   Options: ₹50,000 – ₹2 Lakh, ₹2 – ₹5 Lakh, ₹5 – ₹10 Lakh, ₹10 Lakh+.
3. **Monthly Income**: "What is your monthly income?"
   Options: ₹15k – ₹25k, ₹25k – ₹50k, ₹50k – ₹1 Lakh, ₹1 Lakh+.
   👉 **AFTER THIS QUESTION**: Show: "✅ Based on your details, you are likely eligible 👍" then ask the next question.
   *Tip: You can say "You are likely eligible for ₹X" with an estimate if they provided a high income.*
4. **Employment Type**: "What do you do?"
   Options: Salaried, Self-employed.
5. **City**: "Which city are you in?"

# SMART CONDITIONAL QUESTIONS (ASK ONLY IF CORE 5 ARE DONE)
- **If Home Loan**: Ask Property value / Purchase or resale.
- **If Business Loan**: Ask Business turnover.
- **If Low Income (< ₹25k)**: Ask if they have a co-applicant.
- **If High Amount (> ₹10 Lakh)**: Ask CIBIL score range (optional).

# CURRENT APPLICATION DETAILS
${JSON.stringify(enquiryData, null, 2)}

# CLOSING
Once all required details are gathered, say:
"🎉 Thank you! We are checking the best loan options for you. Our expert will contact you shortly."
Simulate buttons:
[Call me now]
[Send details on WhatsApp]
`;
`;`

    return basePrompt.trim();
}



/**
 * Generate conversation context for AI
 */
function generateConversationContext(enquiry) {
    const context = [];

    if (enquiry.intent) context.push(`Intent: ${enquiry.intent}`);
    if (enquiry.clientName) context.push(`Name: ${enquiry.clientName}`);
    if (enquiry.age) context.push(`Age: ${enquiry.age}`);
    if (enquiry.city) context.push(`City: ${enquiry.city}`);
    if (enquiry.cityArea) context.push(`Area: ${enquiry.cityArea}`);
    if (enquiry.loanType) context.push(`Loan Type: ${enquiry.loanType}`);
    if (enquiry.loanAmount) context.push(`Loan Amount: ${enquiry.loanAmount}`);
    if (enquiry.profession) context.push(`Profession: ${enquiry.profession}`);
    if (enquiry.netSalary) context.push(`Net Salary: ${enquiry.netSalary}`);
    if (enquiry.salaryMode) context.push(`Salary Mode: ${enquiry.salaryMode}`);
    if (enquiry.companyName) context.push(`Company: ${enquiry.companyName}`);
    if (enquiry.totalYearsInJob) context.push(`Work Experience: ${enquiry.totalYearsInJob} years`);
    if (enquiry.cibilScore) context.push(`CIBIL Score: ${enquiry.cibilScore}`);
    
    // Balance Transfer Specific
    if (enquiry.intent === 'balance_transfer' || enquiry.isBalanceTransfer) {
        if (enquiry.currentBank) context.push(`Current Bank: ${enquiry.currentBank}`);
        if (enquiry.outstandingAmount) context.push(`Outstanding Amount: ${enquiry.outstandingAmount}`);
        if (enquiry.currentInterestRate) context.push(`Current ROI: ${enquiry.currentInterestRate}%`);
        if (enquiry.emisCompleted) context.push(`EMIs Completed: ${enquiry.emisCompleted}`);
    }

    // Property Specific
    if (enquiry.propertyLocation) context.push(`Property Location: ${enquiry.propertyLocation}`);
    if (enquiry.propertyValue) context.push(`Property Value: ${enquiry.propertyValue}`);
    if (enquiry.propertyFinalized !== null && enquiry.propertyFinalized !== undefined) context.push(`Property Finalized: ${enquiry.propertyFinalized ? 'Yes' : 'No'}`);

    return context.length > 0 ? `\n\nCurrent Application Details:\n${context.join('\n')}` : '';
}

module.exports = {
    generateSystemPrompt,
    generateConversationContext
}