const httpStatus = require('http-status').default;
const tokenService = require('../services/token.service');
const Admin = require('../models/admin/admin.model');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const RequestContext = require('../utils/context');

/**
 * Middleware to authenticate and authorize for Admin operations.
 * Resolves JWTs against the Admin collection only.
 */
const adminAuth = catchAsync(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Please authenticate');
    }

    try {
        const payload = tokenService.verifyToken(token);
        
        // Fetch Admin specifically for session validation
        const admin = await Admin.findById(payload.sub).select('+tokenVersion').lean();

        if (!admin) {
            throw new AppError(httpStatus.UNAUTHORIZED, 'Admin not found');
        }

        // Verify token version to support session invalidation on logout
        if (payload.v !== admin.tokenVersion) {
            throw new AppError(httpStatus.UNAUTHORIZED, 'Session expired. Please login again.');
        }

        req.admin = admin;
        RequestContext.set('adminId', admin._id);
        RequestContext.set('userId', admin._id); // for logging compatibility
        next();
    } catch (error) {
        console.error('DEBUG: adminAuth middleware failed with error:', error);
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(httpStatus.UNAUTHORIZED, 'Please authenticate');
    }
});

module.exports = adminAuth;
