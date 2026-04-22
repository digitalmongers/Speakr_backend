const mongoose = require('mongoose');

const auditLogSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        action: {
            type: String,
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['SUCCESS', 'FAILURE'],
            default: 'SUCCESS',
        },
        entity: {
            type: String,
            index: true,
        },
        entityId: {
            type: mongoose.Schema.Types.Mixed,
            index: true,
        },
        oldData: {
            type: mongoose.Schema.Types.Mixed,
        },
        newData: {
            type: mongoose.Schema.Types.Mixed,
        },
        context: {
            requestId: String,
            ip: String,
            userAgent: String,
            path: String,
            method: String,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
        },
        error: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Add TTL index for automatic log cleanup (optional, but good practice)
// This will delete logs older than 30 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
