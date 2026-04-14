/**
 * Parse user responses and extract structured data for loan enquiries
 */

/**
 * Parse loan type
 */
function parseLoanType(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('personal') || lowerText.includes('consumer')) {
        return { loanType: 'personal' };
    } else if (lowerText.includes('home') || lowerText.includes('housing')) {
        return { loanType: 'home' };
    } else if (lowerText.includes('business') || lowerText.includes('commercial')) {
        return { loanType: 'business' };
    } else if (lowerText.includes('education') || lowerText.includes('student')) {
        return { loanType: 'education' };
    } else if (lowerText.includes('vehicle') || lowerText.includes('car') || lowerText.includes('bike')) {
        return { loanType: 'vehicle' };
    } else if (lowerText.includes('gold') || lowerText.includes('jewellery')) {
        return { loanType: 'gold' };
    }

    return { loanType: null };
}

/**
 * Parse loan amount
 */
function parseLoanAmount(text) {
    // Handle various formats: "1 lakh", "50,000", "1,00,000", "50000"
    const amountPatterns = [
        /(\d+(?:,\d+)*(?:\.\d+)?)\s*(lakh|lacs|lac)/i,
        /(\d+(?:,\d+)*(?:\.\d+)?)\s*(thousand|k)/i,
        /(\d+(?:,\d+)*(?:\.\d+)?)\s*(crore)/i,
        /₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/
    ];

    for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match) {
            let amount = parseFloat(match[1].replace(/,/g, ''));

            if (match[2]) {
                const unit = match[2].toLowerCase();
                if (unit.includes('lakh') || unit.includes('lac')) {
                    amount *= 100000;
                } else if (unit.includes('thousand') || unit === 'k') {
                    amount *= 1000;
                } else if (unit.includes('crore')) {
                    amount *= 10000000;
                }
            }

            return { loanAmount: Math.round(amount) };
        }
    }

    return { loanAmount: null };
}

/**
 * Parse loan tenure
 */
function parseLoanTenure(text) {
    const tenurePatterns = [
        /(\d+)\s*(?:months?|yrs?|years?)/i,
        /(\d+)\s*(?:month|yr|year)/i
    ];

    for (const pattern of tenurePatterns) {
        const match = text.match(pattern);
        if (match) {
            return { loanTenure: parseInt(match[1], 10) };
        }
    }

    return { loanTenure: null };
}

/**
 * Parse employment type
 */
function parseEmploymentType(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('salaried') || lowerText.includes('salary') || lowerText.includes('job')) {
        return { employmentType: 'salaried' };
    } else if (lowerText.includes('self') && lowerText.includes('employed')) {
        return { employmentType: 'self-employed' };
    } else if (lowerText.includes('business') || lowerText.includes('owner')) {
        return { employmentType: 'business-owner' };
    } else if (lowerText.includes('student')) {
        return { employmentType: 'student' };
    } else if (lowerText.includes('retired')) {
        return { employmentType: 'retired' };
    }

    return { employmentType: null };
}

/**
 * Parse monthly income
 */
function parseMonthlyIncome(text) {
    return parseLoanAmount(text); // Same logic as loan amount
}

/**
 * Parse contact information
 */
function parseContactInfo(text) {
    const contactInfo = {
        name: null,
        email: null
    };

    // Extract email
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) {
        contactInfo.email = emailMatch[1];
    }

    // Extract name (everything before email or first meaningful text)
    let nameText = text;
    if (emailMatch) {
        nameText = text.substring(0, text.indexOf(emailMatch[0]));
    }

    // Clean up name - remove common loan-related words
    contactInfo.name = nameText
        .replace(/loan|apply|application|amount|rupees|lakh/gi, '')
        .replace(/[,\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return contactInfo;
}

/**
 * Parse existing loans
 */
function parseExistingLoans(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('yes') || lowerText.includes('have') || lowerText.includes('existing')) {
        // Try to extract amount
        const amountData = parseLoanAmount(text);
        return {
            existingLoans: true,
            existingLoanAmount: amountData.loanAmount
        };
    } else if (lowerText.includes('no') || lowerText.includes('none') || lowerText.includes('not')) {
        return { existingLoans: false };
    }

    return { existingLoans: null };
}

/**
 * Parse credit score
 */
function parseCreditScore(text) {
    const scoreMatch = text.match(/(\d{3})/);
    if (scoreMatch) {
        const score = parseInt(scoreMatch[1], 10);
        if (score >= 300 && score <= 900) {
            return { creditScore: score };
        }
    }

    return { creditScore: null };
}

/**
 * Check if user is disinterested
 */
function isUserDisinterested(text, conversationHistory = []) {
    const lowerText = text.toLowerCase();

    // Direct disinterest signals
    const disinterestKeywords = [
        'no thanks', 'not interested', 'don\'t want', 'no need', 'cancel',
        'stop', 'later', 'bye', 'goodbye', 'talk to you later',
        'call me later', 'not now', 'maybe later', 'another time'
    ];

    if (disinterestKeywords.some(keyword => lowerText.includes(keyword))) {
        return true;
    }

    // Check conversation history for repeated disinterest
    if (conversationHistory.length > 2) {
        const recentMessages = conversationHistory.slice(-3);
        const disinterestCount = recentMessages.filter(msg =>
            disinterestKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
        ).length;

        if (disinterestCount >= 2) {
            return true;
        }
    }

    return false;
}

/**
 * Parse comprehensive response with all loan details
 */
function parseComprehensiveResponse(text) {
    const result = {
        loanType: null,
        loanAmount: null,
        loanTenure: null,
        loanPurpose: null,
        name: null,
        email: null,
        employmentType: null,
        monthlyIncome: null,
        companyName: null,
        workExperience: null,
        city: null,
        existingLoans: null,
        existingLoanAmount: null,
        creditScore: null
    };

    // Parse loan type
    const loanTypeData = parseLoanType(text);
    if (loanTypeData.loanType) {
        result.loanType = loanTypeData.loanType;
    }

    // Parse loan amount
    const amountData = parseLoanAmount(text);
    if (amountData.loanAmount) {
        result.loanAmount = amountData.loanAmount;
    }

    // Parse loan tenure
    const tenureData = parseLoanTenure(text);
    if (tenureData.loanTenure) {
        result.loanTenure = tenureData.loanTenure;
    }

    // Parse employment type
    const employmentData = parseEmploymentType(text);
    if (employmentData.employmentType) {
        result.employmentType = employmentData.employmentType;
    }

    // Parse monthly income
    const incomePatterns = [
        /(?:income|salary|earning)[\s:]*₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i,
        /(?:earn|make)[\s:]*₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i
    ];

    for (const pattern of incomePatterns) {
        const match = text.match(pattern);
        if (match) {
            const incomeData = parseLoanAmount(match[0]);
            if (incomeData.loanAmount) {
                result.monthlyIncome = incomeData.loanAmount;
                break;
            }
        }
    }

    // Parse contact info
    const contactData = parseContactInfo(text);
    if (contactData.name) result.name = contactData.name;
    if (contactData.email) result.email = contactData.email;

    // Parse existing loans
    const existingLoansData = parseExistingLoans(text);
    if (existingLoansData.existingLoans !== null) {
        result.existingLoans = existingLoansData.existingLoans;
        if (existingLoansData.existingLoanAmount) {
            result.existingLoanAmount = existingLoansData.existingLoanAmount;
        }
    }

    // Parse credit score
    const creditData = parseCreditScore(text);
    if (creditData.creditScore) {
        result.creditScore = creditData.creditScore;
    }

    // Extract company name
    const companyPatterns = [
        /(?:company|organization|firm|work)[\s:]+([A-Za-z\s&]+?)(?:\n|,|\.|\d|$)/i,
        /(?:at|with)\s+([A-Za-z\s&]+?)(?:\n|,|\.|\d|$)/i
    ];

    for (const pattern of companyPatterns) {
        const match = text.match(pattern);
        if (match) {
            result.companyName = match[1].trim();
            break;
        }
    }

    // Extract city
    const cityPatterns = [
        /(?:city|location|from)[\s:]+([A-Za-z\s]+?)(?:\n|,|\.|\d|$)/i
    ];

    for (const pattern of cityPatterns) {
        const match = text.match(pattern);
        if (match) {
            result.city = match[1].trim();
            break;
        }
    }

    // Extract work experience
    const expPatterns = [
        /(?:experience|exp)[\s:]*(\d+)\s*(?:years?|yrs?)/i
    ];

    for (const pattern of expPatterns) {
        const match = text.match(pattern);
        if (match) {
            result.workExperience = parseInt(match[1], 10);
            break;
        }
    }

    return result;
}

module.exports = {
    parseLoanType,
    parseLoanAmount,
    parseLoanTenure,
    parseEmploymentType,
    parseMonthlyIncome,
    parseContactInfo,
    parseExistingLoans,
    parseCreditScore,
    isUserDisinterested,
    parseComprehensiveResponse
};