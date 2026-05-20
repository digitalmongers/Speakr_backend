const tokenService = require('../services/token.service');
const userRepository = require('../repositories/user.repository');
const { ROLES } = require('../constants');
const RequestContext = require('../utils/context');

/**
 * Middleware to optionally authenticate and authorize for USER role.
 * If a valid token is provided, req.user and RequestContext are populated.
 * If no token or invalid token is provided, it does not throw an error and fails open.
 */
const optionalAuth = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next();
    }

    try {
        const payload = tokenService.verifyToken(token);
        // Only fetch required fields: role and tokenVersion
        const user = await userRepository.getUserForSession(payload.sub);

        if (user && payload.v === user.tokenVersion && user.role === ROLES.USER) {
            req.user = user;
            RequestContext.set('userId', user._id);
        }
    } catch (error) {
        // Fail open silently for optional authentication
    }

    next();
};

module.exports = optionalAuth;
