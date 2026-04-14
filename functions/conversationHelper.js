const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');

/**
 * Save or update contact information
 */
async function saveContact(phoneNumber) {
    try {
        let contact = await Contact.findOne({ phoneNumber });

        if (contact) {
            // Update existing contact
            contact.lastContactDate = new Date();
            contact.totalConversations += 1;
            await contact.save();
        } else {
            // Create new contact
            contact = new Contact({
                phoneNumber,
                firstContactDate: new Date(),
                lastContactDate: new Date(),
                totalConversations: 1
            });
            await contact.save();
        }

        return contact;
    } catch (error) {
        console.error('Error saving contact:', error);
        throw error;
    }
}

/**
 * Save conversation with messages and token counts
 */
async function saveConversation(phoneNumber, userMessage, aiResponse, inputTokens = 0, outputTokens = 0) {
    try {
        // Create new conversation
        const conversation = new Conversation({
            phoneNumber,
            messages: [
                {
                    role: 'user',
                    content: userMessage,
                    timestamp: new Date(),
                    inputTokens: inputTokens
                },
                {
                    role: 'assistant',
                    content: aiResponse,
                    timestamp: new Date(),
                    outputTokens: outputTokens
                }
            ],
            totalInputTokens: inputTokens,
            totalOutputTokens: outputTokens,
            startedAt: new Date(),
            lastMessageAt: new Date()
        });

        await conversation.save();

        // Update contact token counts
        await Contact.findOneAndUpdate(
            { phoneNumber },
            {
                $inc: {
                    totalInputTokens: inputTokens,
                    totalOutputTokens: outputTokens
                }
            }
        );

        return conversation;
    } catch (error) {
        console.error('Error saving conversation:', error);
        throw error;
    }
}

/**
 * Estimate token count (rough approximation)
 * More accurate would be to use tiktoken library
 */
function estimateTokens(text) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
}

module.exports = {
    saveContact,
    saveConversation,
    estimateTokens
};