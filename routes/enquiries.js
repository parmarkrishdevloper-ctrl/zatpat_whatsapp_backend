const express = require('express');
const router = express.Router();
const {
    getAllEnquiries,
    getEnquiryById,
    updateEnquiryStatus,
    getEnquiryStats
} = require('../functions/loanEnquiryHelper');
const { authMiddleware } = require('../middleware/auth.cjs');

/**
 * GET /api/enquiries/stats
 * Get enquiry statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const stats = await getEnquiryStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching enquiry stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enquiry statistics',
            error: error.message
        });
    }
});

/**
 * GET /api/enquiries
 * Get all enquiries with optional filters
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            tags: req.query.tags ? req.query.tags.split(',') : undefined,
            callbackRequested: req.query.callbackRequested === 'true' ? true : req.query.callbackRequested === 'false' ? false : undefined,
            loanType: req.query.loanType,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        };

        const enquiries = await getAllEnquiries(filters);

        res.json({
            success: true,
            count: enquiries.length,
            data: enquiries
        });
    } catch (error) {
        console.error('Error fetching enquiries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enquiries',
            error: error.message
        });
    }
});

/**
 * GET /api/enquiries/:id
 * Get specific enquiry by ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const enquiry = await getEnquiryById(req.params.id);

        if (!enquiry) {
            return res.status(404).json({
                success: false,
                message: 'Enquiry not found'
            });
        }

        res.json({
            success: true,
            data: enquiry
        });
    } catch (error) {
        console.error('Error fetching enquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enquiry',
            error: error.message
        });
    }
});

/**
 * PUT /api/enquiries/:id/status
 * Update enquiry status
 */
router.put('/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const validStatuses = ['new', 'in_progress', 'documents_pending', 'under_review', 'approved', 'rejected', 'disbursed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const enquiry = await updateEnquiryStatus(req.params.id, status);

        res.json({
            success: true,
            message: 'Status updated successfully',
            data: enquiry
        });
    } catch (error) {
        console.error('Error updating enquiry status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update enquiry status',
            error: error.message
        });
    }
});

/**
 * GET /api/enquiries/callback/pending
 * Get all pending callback requests
 */
router.get('/callback/pending', authMiddleware, async (req, res) => {
    try {
        const enquiries = await getAllEnquiries({
            callbackRequested: true,
            status: 'in_progress'
        });

        res.json({
            success: true,
            count: enquiries.length,
            data: enquiries
        });
    } catch (error) {
        console.error('Error fetching callback requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch callback requests',
            error: error.message
        });
    }
});

/**
 * GET /api/enquiries/tags/:tag
 * Get enquiries by tag (high-value, etc.)
 */
router.get('/tags/:tag', authMiddleware, async (req, res) => {
    try {
        const enquiries = await getAllEnquiries({
            tags: [req.params.tag]
        });

        res.json({
            success: true,
            count: enquiries.length,
            data: enquiries
        });
    } catch (error) {
        console.error('Error fetching enquiries by tag:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enquiries',
            error: error.message
        });
    }
});

/**
 * GET /api/enquiries/loantype/:type
 * Get enquiries by loan type
 */
router.get('/loantype/:type', authMiddleware, async (req, res) => {
    try {
        const enquiries = await getAllEnquiries({
            loanType: req.params.type
        });

        res.json({
            success: true,
            count: enquiries.length,
            data: enquiries
        });
    } catch (error) {
        console.error('Error fetching enquiries by loan type:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enquiries',
            error: error.message
        });
    }
});

module.exports = router;