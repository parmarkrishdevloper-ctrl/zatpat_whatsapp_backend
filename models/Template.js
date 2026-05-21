const mongoose = require('mongoose');

/**
 * Template — reusable message templates with {{variable}} support
 */
const templateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: 'General',
        trim: true
    },
    body: {
        type: String,
        required: true
    },
    variables: {
        type: [String],
        default: []
    },
    color: {
        type: String,
        default: 'blue'
    },
    createdBy: {
        type: String,
        default: 'admin'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Template', templateSchema);
