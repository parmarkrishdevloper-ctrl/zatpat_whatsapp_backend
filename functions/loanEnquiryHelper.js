const LoanEnquiry = require('../models/LoanEnquiry');
const { parseComprehensiveResponse } = require('./responseParser');
const { extractDataWithAI } = require('./llmDataExtractor'); // Import the new AI extractor

function validateData(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        if (lower === 'null' || lower === 'undefined' || lower === 'none' || lower === 'n/a') return null;
        return value.trim();
    }
    return value;
}

function parseLoanAmount(amount) {
    if (!amount) return null;
    if (typeof amount === 'number') return amount;

    if (typeof amount === 'string') {
        // Handle formats like "1 lakh", "50,000", "1,00,000"
        const cleaned = amount.toLowerCase().replace(/[,]/g, '').trim();

        if (cleaned.includes('lakh') || cleaned.includes('lac') || cleaned.includes('lack') || cleaned.match(/\d\s*l$/)) {
            const num = parseFloat(cleaned.replace(/lakhs|lakh|lack|lacs|lac|l/g, '').trim());
            return isNaN(num) ? null : num * 100000;
        }

        if (cleaned.includes('thousand') || cleaned.includes('k')) {
            const num = parseFloat(cleaned.replace(/thousand|k/g, '').trim());
            return num * 1000;
        }

        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    return null;
}

function validateName(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        if (lower === 'null' || lower === 'undefined' || lower === 'none' || lower === 'n/a') return null;
        let name = value.trim().replace(/\d+/g, '').replace(/[₹$,]/g, '').replace(/lakh|lac|thousand|k|crore/gi, '').replace(/\s+/g, ' ').trim();
        if (name.length > 0 && name.match(/[a-zA-Z]/)) {
            return name;
        }
        return null;
    }
    return null;
}

function applyParsedData(enquiry, data = {}) {
    // Basic Details
    if (data.clientName) enquiry.clientName = validateName(data.clientName);
    else if (data.name) enquiry.clientName = validateName(data.name); 
    
    if (data.city) enquiry.city = validateData(data.city);
    if (data.cityArea) enquiry.cityArea = validateData(data.cityArea);
    if (data.age) enquiry.age = data.age;
    if (data.loanType) enquiry.loanType = validateData(data.loanType);
    if (data.intent) enquiry.intent = data.intent;
    if (data.loanAmount && !enquiry.loanAmount) enquiry.loanAmount = parseLoanAmount(data.loanAmount);
    if (data.cibilScore) enquiry.cibilScore = data.cibilScore;
    if (data.cibilIssueDetail) enquiry.cibilIssueDetail = validateData(data.cibilIssueDetail);
    if (data.profession) enquiry.profession = validateData(data.profession);

    // Salaried Specific Fields
    if (data.companyName) enquiry.companyName = validateData(data.companyName);
    if (data.netSalary) enquiry.netSalary = parseLoanAmount(data.netSalary);
    if (data.grossSalary) enquiry.grossSalary = parseLoanAmount(data.grossSalary);
    if (data.salaryMode) enquiry.salaryMode = validateData(data.salaryMode);
    if (data.existingEmiAmount) enquiry.existingEmiAmount = parseLoanAmount(data.existingEmiAmount);
    if (data.otherIncomeDetail) enquiry.otherIncomeDetail = validateData(data.otherIncomeDetail);
    if (data.coApplicantIncomeDetail) enquiry.coApplicantIncomeDetail = validateData(data.coApplicantIncomeDetail);
    if (data.workExperienceYears) enquiry.workExperienceYears = data.workExperienceYears;
    if (data.totalYearsInJob) enquiry.totalYearsInJob = data.totalYearsInJob;

    // Self Employed & Businessmen Specific Fields
    if (data.companyType) enquiry.companyType = validateData(data.companyType);
    if (data.businessType) enquiry.businessType = validateData(data.businessType);
    if (data.businessVintageYears) enquiry.businessVintageYears = data.businessVintageYears;
    if (data.monthlyAnnualIncome) enquiry.monthlyAnnualIncome = parseLoanAmount(data.monthlyAnnualIncome);
    if (data.itrYears) enquiry.itrYears = data.itrYears;
    if (data.hasGstNumber !== undefined) enquiry.hasGstNumber = data.hasGstNumber;
    if (data.hasCurrentAccount !== undefined) enquiry.hasCurrentAccount = data.hasCurrentAccount;
    if (data.annualProfit) enquiry.annualProfit = parseLoanAmount(data.annualProfit);

    // Self Employed Professional Specific Fields
    if (data.professionalType) enquiry.professionalType = validateData(data.professionalType);
    if (data.yearlyEarnings) enquiry.yearlyEarnings = parseLoanAmount(data.yearlyEarnings);

    // Home/Housing Loan fields
    if (data.propertyFinalized !== undefined) enquiry.propertyFinalized = data.propertyFinalized;
    if (data.propertyType) enquiry.propertyType = validateData(data.propertyType);
    if (data.propertyValue) enquiry.propertyValue = parseLoanAmount(data.propertyValue);
    if (data.saleDeedAmount) enquiry.saleDeedAmount = parseLoanAmount(data.saleDeedAmount);
    if (data.timeToFinalizeProperty) enquiry.timeToFinalizeProperty = validateData(data.timeToFinalizeProperty);
    if (data.preSanctionRequired !== undefined) enquiry.preSanctionRequired = data.preSanctionRequired;
    if (data.propertyLocation) enquiry.propertyLocation = validateData(data.propertyLocation);

    // Property/Mortgage fields
    if (data.loanPurpose) enquiry.loanPurpose = validateData(data.loanPurpose);
    if (data.propertyNature) enquiry.propertyNature = validateData(data.propertyNature);
    if (data.isSelfOccupied !== undefined) enquiry.isSelfOccupied = data.isSelfOccupied;
    if (data.propertyOwnership) enquiry.propertyOwnership = validateData(data.propertyOwnership);

    // Balance Transfer Fields
    if (data.currentBank) enquiry.currentBank = validateData(data.currentBank);
    if (data.existingLoanBank) enquiry.currentBank = validateData(data.existingLoanBank);
    if (data.currentInterestRate) enquiry.currentInterestRate = data.currentInterestRate;
    if (data.loanStartDate) enquiry.loanStartDate = validateData(data.loanStartDate);
    if (data.outstandingAmount) enquiry.outstandingAmount = parseLoanAmount(data.outstandingAmount);
    if (data.currentEmi) enquiry.currentEmi = parseLoanAmount(data.currentEmi);
    if (data.emisCompleted) enquiry.emisCompleted = data.emisCompleted;
    if (data.missedEmiLast12Months !== undefined) enquiry.missedEmiLast12Months = data.missedEmiLast12Months;
    if (data.balanceTransferGoal) enquiry.balanceTransferGoal = validateData(data.balanceTransferGoal);
    if (data.topUpRequired !== undefined) enquiry.topUpRequired = data.topUpRequired;
    if (data.topUpAmount) enquiry.topUpAmount = parseLoanAmount(data.topUpAmount);

    // Business / MSME Fields
    if (data.isBusinessRegistered !== undefined) enquiry.isBusinessRegistered = data.isBusinessRegistered;
    if (data.isMsmeRegistered !== undefined) enquiry.isMsmeRegistered = data.isMsmeRegistered;
    if (data.businessTurnover) enquiry.businessTurnover = parseLoanAmount(data.businessTurnover);
    if (data.businessNetProfit) enquiry.businessNetProfit = parseLoanAmount(data.businessNetProfit);
    if (data.loanSecurityType) enquiry.loanSecurityType = validateData(data.loanSecurityType);
    if (data.offeredSecurity) enquiry.offeredSecurity = validateData(data.offeredSecurity);

    // General Preferences
    if (data.whenLoanRequired) enquiry.whenLoanRequired = validateData(data.whenLoanRequired);
    if (data.loanPriority) enquiry.loanPriority = validateData(data.loanPriority);

    // Common legacy fallbacks
    if (data.email) enquiry.email = validateData(data.email);
    if (data.preferredCallbackTime) enquiry.preferredCallbackTime = validateData(data.preferredCallbackTime);
}

function hasAnyCoreLoanData(enquiry) {
    return Boolean(
        enquiry.clientName ||
        enquiry.loanType ||
        enquiry.loanAmount ||
        enquiry.profession ||
        enquiry.city
    );
}

function hasAllPrimaryFields(enquiry) {
    const basicInfo = Boolean(
        enquiry.clientName &&
        enquiry.city &&
        enquiry.age &&
        enquiry.loanType &&
        enquiry.intent &&
        enquiry.loanAmount &&
        enquiry.cibilScore &&
        enquiry.profession
    );

    if (!basicInfo) return false;

    // Occupation specific
    if (enquiry.profession === 'Salaried') {
        if (!enquiry.netSalary || !enquiry.salaryMode) return false;
    } else if (enquiry.profession === 'Businessman' || enquiry.profession === 'Businessmen') {
        if (!enquiry.itrYears || enquiry.hasGstNumber === null || enquiry.hasCurrentAccount === null) return false;
    }

    // Property specific
    const propertyLoans = ['Home Loan', 'Mortgage Loan', 'LAP', 'Property', 'Commercial'];
    const isPropertyLoan = propertyLoans.some(type => enquiry.loanType?.includes(type));
    if (isPropertyLoan) {
        if (!enquiry.propertyLocation || !enquiry.propertyValue) return false;
    }

    return true;
}

function getMissingPrimaryFields(enquiry) {
    const missing = [];
    if (!enquiry.clientName) missing.push('name');
    if (!enquiry.city) missing.push('city');
    if (!enquiry.age) missing.push('age');
    if (!enquiry.loanType) missing.push('loanType');
    if (!enquiry.intent) missing.push('intent');
    if (!enquiry.profession) missing.push('profession');
    if (!enquiry.loanAmount) missing.push('loanAmount');
    if (!enquiry.cibilScore) missing.push('cibilScore');
    
    if (enquiry.profession === 'Salaried') {
        if (!enquiry.netSalary) missing.push('netSalary');
        if (!enquiry.salaryMode) missing.push('salaryMode');
    } else if (enquiry.profession === 'Businessman' || enquiry.profession === 'Businessmen') {
        if (!enquiry.itrYears) missing.push('itrYears');
        if (enquiry.hasGstNumber === null) missing.push('hasGstNumber');
        if (enquiry.hasCurrentAccount === null) missing.push('hasCurrentAccount');
    }

    return missing;
}

/**
 * Get or create a loan enquiry for a phone number (phone is logical unique key)
 */
async function getOrCreateEnquiry(phoneNumber) {
    try {
        let enquiry = await LoanEnquiry.findOne({ phoneNumber }).sort({ updatedAt: -1 });

        if (!enquiry) {
            enquiry = new LoanEnquiry({
                phoneNumber,
                conversationStage: 'greeting'
            });
            await enquiry.save();
            console.log(`Created new loan enquiry for ${phoneNumber}`);
        }

        return enquiry;
    } catch (error) {
        console.error('Error in getOrCreateEnquiry:', error);
        throw error;
    }
}

/**
 * Unified upsert from every incoming message.
 * This is the primary storage function to avoid stage-based data loss.
 */
async function upsertEnquiryFromMessage(phoneNumber, messageText) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);
        const regexData = parseComprehensiveResponse(messageText || '');

        // Use AI extraction for better understanding
        let llmData = {};
        try {
            llmData = await extractDataWithAI(messageText, enquiry);
            console.log(`🤖 AI Extracted Data for ${phoneNumber}:`, JSON.stringify(llmData));
        } catch (aiError) {
            console.error('AI Extraction Failed, falling back to regex:', aiError);
        }

        // Check for specific intent first (cancel ONLY - new_loan is now part of data flow)
        if (llmData.intent === 'cancel') {
            await resetEnquiry(phoneNumber);
            const newEnquiry = await getOrCreateEnquiry(phoneNumber);
            return { enquiry: newEnquiry, parsedData: {}, isReset: true };
        }

        // Merge data: AI data takes precedence
        const parsedData = { ...regexData, ...llmData };

        // SMART RESET CHECK: If user provides NEW loan details while we have an old completed enquiry
        if (enquiry.status === 'in_progress' && enquiry.callbackRequested) {
            const newLoanType = parsedData.loanType || llmData.loanType;
            if (newLoanType) {
                // Determine if we should actually reset
                const isDifferentType = enquiry.loanType && newLoanType.toLowerCase() !== enquiry.loanType.toLowerCase();
                const isAlreadyCompleted = enquiry.conversationStage === 'completed' || enquiry.conversationStage === 'review';
                
                if (isDifferentType || isAlreadyCompleted) {
                    console.log(`🚀 New loan type detected (${newLoanType}) for an ${isAlreadyCompleted ? 'already completed' : 'existing'} enquiry. Auto-resetting for new loan.`);
                    await resetEnquiry(phoneNumber);
                    const freshEnquiry = await getOrCreateEnquiry(phoneNumber);
                    applyParsedData(freshEnquiry, parsedData);

                    freshEnquiry.status = 'in_progress';
                    freshEnquiry.conversationStage = hasAllPrimaryFields(freshEnquiry) ? 'review' : 'loan_type';
                    await freshEnquiry.save();

                    return {
                        enquiry: freshEnquiry,
                        parsedData,
                        isReset: true,
                        isSmartReset: true
                    };
                }
            }
        }

        applyParsedData(enquiry, parsedData);

        if (hasAnyCoreLoanData(enquiry)) {
            enquiry.status = 'in_progress';
            if (!enquiry.callbackRequested) {
                enquiry.callbackRequested = true;
                enquiry.preferredCallbackTime = 'ASAP';
            }
        }

        enquiry.conversationStage = hasAllPrimaryFields(enquiry) ? 'review' : 'loan_type';

        enquiry.collectedData.set(`msg_${Date.now()}`, {
            rawText: messageText,
            parsedData
        });

        await enquiry.save();

        return {
            enquiry,
            parsedData,
            missingPrimaryFields: getMissingPrimaryFields(enquiry),
            hasAllPrimaryFields: hasAllPrimaryFields(enquiry),
            isReset: false
        };
    } catch (error) {
        console.error('Error in upsertEnquiryFromMessage:', error);
        throw error;
    }
}

/**
 * Update enquiry data based on conversation stage
 */
async function updateEnquiryData(phoneNumber, stage, data) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);

        switch (stage) {
            case 'greeting':
                applyParsedData(enquiry, data);
                enquiry.conversationStage = hasAllPrimaryFields(enquiry)
                    ? 'review'
                    : 'loan_type';
                break;

            case 'loan_type':
                enquiry.loanType = data.loanType;
                enquiry.conversationStage = 'loan_amount';
                break;

            case 'loan_amount':
                enquiry.loanAmount = parseLoanAmount(data.loanAmount);
                enquiry.loanTenure = data.loanTenure;
                enquiry.conversationStage = 'personal_info';
                break;

            case 'personal_info':
                applyParsedData(enquiry, data);
                enquiry.conversationStage = 'employment_info';
                break;

            case 'employment_info':
                applyParsedData(enquiry, data);
                enquiry.conversationStage = 'financial_info';
                break;

            case 'financial_info':
                applyParsedData(enquiry, data);
                enquiry.conversationStage = 'documents';
                break;

            case 'documents':
                enquiry.documentsRequired = data.documentsRequired || [];
                enquiry.conversationStage = 'review';
                break;

            case 'review':
                applyParsedData(enquiry, data);
                enquiry.callbackRequested = hasAnyCoreLoanData(enquiry);
                enquiry.preferredCallbackTime = enquiry.preferredCallbackTime || 'ASAP';
                enquiry.conversationStage = 'completed';
                enquiry.status = 'in_progress';
                break;

            case 'completed':
                applyParsedData(enquiry, data);
                enquiry.conversationStage = 'completed';
                enquiry.status = 'in_progress';
                break;
        }

        enquiry.collectedData.set(stage, data);

        await enquiry.save();
        console.log(`Updated loan enquiry for ${phoneNumber} - Stage: ${stage}`);

        return enquiry;
    } catch (error) {
        console.error('Error in updateEnquiryData:', error);
        throw error;
    }
}

/**
 * Create a callback request
 */
async function createCallbackRequest(phoneNumber, preferredTime = 'ASAP') {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);

        enquiry.callbackRequested = true;
        enquiry.preferredCallbackTime = preferredTime;
        enquiry.status = 'in_progress';
        enquiry.conversationStage = 'completed';

        await enquiry.save();

        console.log(`Callback request created for ${phoneNumber}`);
        return enquiry;
    } catch (error) {
        console.error('Error in createCallbackRequest:', error);
        throw error;
    }
}

/**
 * Get current conversation stage
 */
async function getCurrentStage(phoneNumber) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);
        return enquiry.conversationStage;
    } catch (error) {
        console.error('Error in getCurrentStage:', error);
        return 'greeting';
    }
}

/**
 * Get all enquiries with filters
 */
async function getAllEnquiries(filters = {}) {
    try {
        const query = {};

        if (filters.status) query.status = filters.status;
        if (filters.tags) query.tags = { $in: filters.tags };
        if (filters.callbackRequested !== undefined) query.callbackRequested = filters.callbackRequested;
        if (filters.loanType) query.loanType = new RegExp(filters.loanType, 'i');

        const enquiries = await LoanEnquiry.find(query)
            .sort({ createdAt: -1 })
            .limit(filters.limit || 100);

        return enquiries;
    } catch (error) {
        console.error('Error in getAllEnquiries:', error);
        throw error;
    }
}

/**
 * Get enquiry by ID
 */
async function getEnquiryById(id) {
    try {
        return await LoanEnquiry.findById(id);
    } catch (error) {
        console.error('Error in getEnquiryById:', error);
        throw error;
    }
}

/**
 * Update enquiry status
 */
async function updateEnquiryStatus(id, status) {
    try {
        const enquiry = await LoanEnquiry.findById(id);
        if (!enquiry) {
            throw new Error('Enquiry not found');
        }

        enquiry.status = status;
        await enquiry.save();

        console.log(`Updated enquiry ${id} status to ${status}`);
        return enquiry;
    } catch (error) {
        console.error('Error in updateEnquiryStatus:', error);
        throw error;
    }
}

/**
 * Reset enquiry to start fresh
 */
async function resetEnquiry(phoneNumber) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);

        enquiry.status = 'new';
        enquiry.conversationStage = 'greeting';
        enquiry.callbackRequested = false;
        enquiry.preferredCallbackTime = null;

        // Clear loan-specific fields
        enquiry.loanType = null;
        enquiry.loanAmount = null;
        enquiry.loanTenure = null;
        enquiry.loanPurpose = null;
        enquiry.employmentType = null;
        enquiry.monthlyIncome = null;
        enquiry.companyName = null;
        enquiry.workExperience = null;
        enquiry.city = null;
        enquiry.state = null;
        enquiry.pincode = null;
        enquiry.existingLoans = null;
        enquiry.existingLoanAmount = null;
        enquiry.creditScore = null;
        enquiry.documentsRequired = [];
        enquiry.documentsSubmitted = [];

        await enquiry.save();
        console.log(`Reset loan enquiry for ${phoneNumber}`);
        return enquiry;
    } catch (error) {
        console.error('Error in resetEnquiry:', error);
        throw error;
    }
}

/**
 * Generate a readable summary of the enquiry
 */
function getEnquirySummary(enquiry) {
    const parts = [];
    if (enquiry.loanType) parts.push(`Type: ${enquiry.loanType}`);
    if (enquiry.loanAmount) parts.push(`Amount: ₹${enquiry.loanAmount}`);
    if (enquiry.loanTenure) parts.push(`Tenure: ${enquiry.loanTenure} months`);
    if (enquiry.monthlyIncome) parts.push(`Income: ₹${enquiry.monthlyIncome}`);
    return parts.join(', ') || 'No details yet';
}

/**
 * Get enquiry statistics
 */
async function getEnquiryStats() {
    try {
        const total = await LoanEnquiry.countDocuments();
        const newEnquiries = await LoanEnquiry.countDocuments({ status: 'new' });
        const inProgress = await LoanEnquiry.countDocuments({ status: 'in_progress' });
        const callbackRequests = await LoanEnquiry.countDocuments({
            callbackRequested: true,
            status: { $in: ['new', 'in_progress'] }
        });
        const highValueLoans = await LoanEnquiry.countDocuments({ tags: 'high-value' });
        const personalLoans = await LoanEnquiry.countDocuments({ loanType: 'personal' });
        const homeLoans = await LoanEnquiry.countDocuments({ loanType: 'home' });

        return {
            total,
            newEnquiries,
            inProgress,
            callbackRequests,
            highValueLoans,
            personalLoans,
            homeLoans
        };
    } catch (error) {
        console.error('Error in getEnquiryStats:', error);
        throw error;
    }
}

module.exports = {
    getOrCreateEnquiry,
    upsertEnquiryFromMessage,
    updateEnquiryData,
    createCallbackRequest,
    getCurrentStage,
    getAllEnquiries,
    getEnquiryById,
    updateEnquiryStatus,
    resetEnquiry,
    getEnquirySummary,
    getEnquiryStats,
    hasAllPrimaryFields
};