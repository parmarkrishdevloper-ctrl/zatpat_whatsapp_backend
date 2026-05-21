const mongoose = require('mongoose');

/**
 * Campaign — Broadcast campaign tracking
 */
const campaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    groupName: {
        type: String,
        default: 'Custom'
    },
    recipients: {
        type: [String], // array of phone numbers
        default: []
    },
    recipientCount: {
        type: Number,
        default: 0
    },
    message: {
        type: String,
        required: true
    },
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Template',
        default: null
    },
    scheduledAt: {
        type: Date,
        default: null
    },
    startedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled'],
        default: 'draft'
    },
    // Delivery tracking
    delivered: {
        type: Number,
        default: 0
    },
    failed: {
        type: Number,
        default: 0
    },
    // Reply tracking
    replies: {
        type: Number,
        default: 0
    },
    repliedNumbers: {
        type: [String],
        default: []
    },
    // Error log
    errors: [{
        phone: String,
        error: String,
        at: { type: Date, default: Date.now }
    }],
    createdBy: {
        type: String,
        default: 'admin'
    }
}, {
    timestamps: true
});

// Computed delivery rate
campaignSchema.virtual('deliveryRate').get(function () {
    if (!this.recipientCount) return 0;
    return ((this.delivered / this.recipientCount) * 100).toFixed(1);
});

// Computed reply rate
campaignSchema.virtual('replyRate').get(function () {
    if (!this.delivered) return 0;
    return ((this.replies / this.delivered) * 100).toFixed(1);
});

campaignSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Campaign', campaignSchema);
