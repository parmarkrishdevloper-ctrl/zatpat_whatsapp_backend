const mongoose = require('mongoose');

/**
 * BotConfig — stores the admin-editable system prompt for each flow
 * Only ONE document per flowKey exists (upsert pattern).
 */
const botConfigSchema = new mongoose.Schema({
    flowKey: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        // e.g.  'home-loan', 'personal-loan', 'business-loan', 'default'
    },
    flowName: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
    },
    // The editable portion — the ROLE + TONE + RULES section
    // The dynamic {{name}} / {{context}} placeholders are filled at runtime
    systemPrompt: {
        type: String,
        required: true,
    },
    // Is this flow active?
    isActive: {
        type: Boolean,
        default: true,
    },
    // Which loan types trigger this flow (substring match, lowercase)
    triggerKeywords: {
        type: [String],
        default: [],
    },
    updatedBy: {
        type: String,
        default: 'admin',
    },
}, { timestamps: true });

module.exports = mongoose.model('BotConfig', botConfigSchema);
