const httpStatus = require('http-status');
const tokenService = require('../services/token.service');
const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { ROLES } = require('../constants');

/**
 * Middleware to authenticate and authorize for USER role only
 */
const userAuth = catchAsync(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Please authenticate');
    }

    try {
        const payload = tokenService.verifyToken(token);
        const user = await userRepository.getUserById(payload.sub);

        if (!user) {
            throw new AppError(httpStatus.UNAUTHORIZED, 'User not found');
        }

        // Verify token version
        if (payload.v !== user.tokenVersion) {
            throw new AppError(httpStatus.UNAUTHORIZED, 'Session expired. Please login again.');
        }

        // Strictly check for USER role
        if (user.role !== ROLES.USER) {
            throw new AppError(httpStatus.FORBIDDEN, 'Forbidden: This resource is accessible to users only');
        }

        req.user = user;
        next();
    } catch (error) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Please authenticate');
    }
});

module.exports = userAuth;
