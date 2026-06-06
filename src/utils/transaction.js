const mongoose = require('mongoose');
const Logger = require('./logger');

/**
 * Execute operations within a transaction if supported, otherwise fall back to non-transactional execution.
 * @param {Function} callback - Async function that takes the session as an argument: (session) => Promise<any>
 * @returns {Promise<any>} The result of the callback
 */
const runTransaction = async (callback) => {
    let session = null;
    try {
        session = await mongoose.startSession();
        let result;
        await session.withTransaction(async () => {
            result = await callback(session);
        });
        return result;
    } catch (error) {
        const errorMessage = error.message || '';
        const isTransactionUnsupported = 
            errorMessage.includes('transaction') || 
            errorMessage.includes('replica set') || 
            errorMessage.includes('session') ||
            error.codeName === 'CommandNotSupported' || 
            error.code === 20;

        if (isTransactionUnsupported) {
            Logger.warn('Transactions/Sessions not supported by the database. Falling back to non-transactional execution.', {
                error: errorMessage
            });
            // Fall back and run callback without a session
            return callback(null);
        }
        
        throw error;
    } finally {
        if (session) {
            try {
                await session.endSession();
            } catch (err) {
                // Ignore session end errors
            }
        }
    }
};

module.exports = { runTransaction };
