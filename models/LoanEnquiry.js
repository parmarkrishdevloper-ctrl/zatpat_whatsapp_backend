const mongoose = require('mongoose');

const loanEnquirySchema = new mongoose.Schema({
    // Essential Contact Information
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    clientName: { type: String, default: null },
    city: { type: String, default: null },
    age: { type: Number, default: null },
    cityArea: { type: String, default: null },
    
    // Additional fields for new requirement
    propertyLocation: { type: String, default: null },
    emisCompleted: { type: Number, default: null },
    annualProfit: { type: Number, default: null },
    yearlyEarnings: { type: Number, default: null },
    totalYearsInJob: { type: Number, default: null },
    intent: { type: String, enum: ['new_loan', 'balance_transfer'], default: null },

    // Core Loan Details
    loanType: {
        type: String,
        default: null
    },
    loanAmount: { type: Number, default: null },
    cibilScore: { type: Number, default: null },
    cibilIssueDetail: { type: String, default: null },
    
    // Profession
    profession: {
        type: String,
        default: null
    },

    // Salaried Specific Fields
    companyName: { type: String, default: null },
    netSalary: { type: Number, default: null },
    grossSalary: { type: Number, default: null },
    salaryMode: { type: String, default: null },
    existingEmiAmount: { type: Number, default: null },
    otherIncomeDetail: { type: String, default: null },
    coApplicantIncomeDetail: { type: String, default: null },
    workExperienceYears: { type: Number, default: null },

    // Self Employed & Businessmen Specific Fields
    companyType: { type: String, default: null },
    businessType: { type: String, default: null },
    businessVintageYears: { type: Number, default: null },
    monthlyAnnualIncome: { type: Number, default: null },
    itrYears: { type: Number, default: null },
    hasGstNumber: { type: Boolean, default: null },
    hasCurrentAccount: { type: Boolean, default: null },
    
    // Self Employed Professional Specific
    professionalType: { type: String, default: null },
    
    // Home/Housing Loan fields
    propertyFinalized: { type: Boolean, default: null },
    propertyType: { type: String, default: null },
    propertyValue: { type: Number, default: null },
    saleDeedAmount: { type: Number, default: null },
    timeToFinalizeProperty: { type: String, default: null },
    preSanctionRequired: { type: Boolean, default: null },
    
    // Property/Mortgage fields
    loanPurpose: { type: String, default: null },
    propertyNature: { type: String, default: null },
    isSelfOccupied: { type: Boolean, default: null },
    propertyOwnership: { type: String, default: null },
    
    // Balance Transfer Fields
    currentBank: { type: String, default: null },
    currentInterestRate: { type: Number, default: null },
    loanStartDate: { type: String, default: null },
    outstandingAmount: { type: Number, default: null },
    currentEmi: { type: Number, default: null },
    missedEmiLast12Months: { type: Boolean, default: null },
    balanceTransferGoal: { type: String, default: null },
    topUpRequired: { type: Boolean, default: null },
    topUpAmount: { type: Number, default: null },
    
    // Business / MSME Fields
    isBusinessRegistered: { type: Boolean, default: null },
    isMsmeRegistered: { type: Boolean, default: null },
    businessTurnover: { type: Number, default: null },
    businessNetProfit: { type: Number, default: null },
    loanSecurityType: { type: String, default: null },
    offeredSecurity: { type: String, default: null },
    
    // General Preferences
    whenLoanRequired: { type: String, default: null },
    loanPriority: { type: String, default: null },

    // Status & tags
    status: {
        type: String,
        enum: ['new', 'in_progress', 'documents_pending', 'under_review', 'approved', 'rejected', 'disbursed'],
        default: 'new'
    },
    tags: [{ type: String }],
    
    // Conversation management
    conversationStage: { type: String, default: 'greeting' },
    callbackRequested: { type: Boolean, default: false },
    preferredCallbackTime: { type: String, default: null },
    
    // Fallback data
    collectedData: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Timestamps
    enquiryDate: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
}, {
    timestamps: true
});

loanEnquirySchema.index({ phoneNumber: 1, createdAt: -1 });
loanEnquirySchema.index({ status: 1 });
loanEnquirySchema.index({ tags: 1 });
loanEnquirySchema.index({ loanType: 1 });

// Auto-tag based on loan amount
loanEnquirySchema.pre('save', function () {
    if (this.loanAmount) {
        if (this.loanAmount >= 500000) {
            if (!this.tags.includes('high-value')) {
                this.tags.push('high-value');
            }
        } else {
            this.tags = this.tags.filter(tag => tag !== 'high-value');
        }
    }
});

module.exports = mongoose.model('LoanEnquiry', loanEnquirySchema);