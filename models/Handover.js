const mongoose = require('mongoose');

/**
 * Handover — tracks which conversations are under human control
 * When controller = 'human', the bot skips auto-reply for that phone number.
 */
const handoverSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    controller: {
        type: String,
        enum: ['bot', 'human'],
        default: 'bot'
    },
    agentName: {
        type: String,
        default: null
    },
    takenOverAt: {
        type: Date,
        default: null
    },
    returnedAt: {
        type: Date,
        default: null
    },
    notes: {
        type: String,
        default: ''
    },
    history: [{
        action: { type: String, enum: ['takeover', 'return'] },
        agent: String,
        at: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Handover', handoverSchema);
