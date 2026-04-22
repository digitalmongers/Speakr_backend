const AuditLog = require('../models/auditLog.model');
const RequestContext = require('../utils/context');
const Logger = require('../utils/logger');

class AuditService {
    /**
     * Record an audit event
     * @param {Object} params
     * @param {string} params.action - Event action (e.g. AUTH_LOGIN)
     * @param {string} [params.status='SUCCESS'] - Status of the event
     * @param {string} [params.entity] - Target entity type
     * @param {string} [params.entityId] - Target entity ID
     * @param {Object} [params.oldData] - Data before changes
     * @param {Object} [params.newData] - Data after changes
     * @param {Object} [params.metadata] - Additional context
     * @param {string} [params.error] - Error message if failed
     * @param {string} [params.userId] - User ID if not available in context
     */
    static async record({
        action,
        status = 'SUCCESS',
        entity,
        entityId,
        oldData,
        newData,
        metadata,
        error,
        userId,
    }) {
        try {
            const context = RequestContext.getAll();
            
            const logEntry = {
                user: userId || context.userId,
                action,
                status,
                entity,
                entityId,
                oldData,
                newData,
                metadata,
                error,
                context: {
                    requestId: context.requestId,
                    ip: context.ip,
                    userAgent: context.userAgent,
                    path: context.path,
                    method: context.method,
                },
            };

            await AuditLog.create(logEntry);
            
            // Also log to winston for disk/external log aggregation
            Logger.info(`Audit Log: ${action} - ${status}`, {
                action,
                status,
                entity,
                entityId,
                user: userId || context.userId,
            });
        } catch (err) {
            // We don't want audit logging to break the main application flow
            // but we absolutely want to know if it fails
            Logger.error('Failed to create audit log', { error: err.message, action });
        }
    }
}

module.exports = AuditService;
