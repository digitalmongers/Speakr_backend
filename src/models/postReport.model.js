const mongoose = require('mongoose');

/**
 * Valid report reasons exposed as a constant so they can be shared
 * with the validation layer without duplicating the enum definition.
 */
const POST_REPORT_REASONS = ['spam', 'fake content', 'abuse', 'copyright'];

const postReportSchema = new mongoose.Schema(
    {
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
            required: [true, 'Post reference is required'],
        },
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Reporter user reference is required'],
        },
        reason: {
            type: String,
            enum: {
                values: POST_REPORT_REASONS,
                message: `Reason must be one of: ${POST_REPORT_REASONS.join(', ')}`,
            },
            required: [true, 'Report reason is required'],
        },
    },
    {
        timestamps: true,
    }
);

// Primary guard: enforces one-report-per-user-per-post at the DB level.
// Even if the application-layer check is bypassed, MongoDB will reject the duplicate.
postReportSchema.index({ post: 1, reporter: 1 }, { unique: true });

// Secondary index: optimises queries that filter or paginate by reporter (admin dashboards, user history).
postReportSchema.index({ reporter: 1 });

// Secondary index: optimises admin queries that aggregate reports per post.
postReportSchema.index({ post: 1 });

const PostReport = mongoose.model('PostReport', postReportSchema);

module.exports = {
    PostReport,
    POST_REPORT_REASONS,
};
