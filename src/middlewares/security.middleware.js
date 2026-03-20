const helmet = require('helmet');
const DOMPurify = require('isomorphic-dompurify');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const httpStatus = require('http-status');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');
const env = require('../configs/env');

/**
 * Enterprise Security Middleware Configuration
 * Implements strict CSP, Sanitization, CORS Whitelisting, and Rate Limiting.
 */
const configureSecurity = (app) => {
    // Set security HTTP headers with strict CSP
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                fontSrc: ["'self'", 'https:', 'data:'],
                frameAncestors: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
                objectSrc: ["'none'"],
                scriptSrc: ["'self'"],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
                upgradeInsecureRequests: [],
            },
        },
    }));

    // DOMPurify Sanitization Middleware (Prevention of XSS in Request Body)
    // XSS Clean was already installed in app.js, but this is much more robust for deep objects
    app.use((req, res, next) => {
        if (req.body && typeof req.body === 'object') {
            const sanitizeObject = (obj) => {
                for (const key in obj) {
                    if (typeof obj[key] === 'string') {
                        obj[key] = DOMPurify.sanitize(obj[key]);
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        sanitizeObject(obj[key]);
                    }
                }
            };
            sanitizeObject(req.body);
        }
        next();
    });

    // CORS configuration - Enterprise Whitelist approach
    const whitelist = env.ALLOWED_ORIGINS
        ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];

    app.use(
        cors({
            origin: function (origin, callback) {
                // Allow requests with no origin (like mobile apps or curl)
                if (!origin) {
                    if (env.NODE_ENV === 'development') Logger.debug('CORS: No origin detected, allowing request');
                    return callback(null, true);
                }

                if (env.NODE_ENV === 'development') {
                    Logger.debug(`CORS: Origin [${origin}] detected`);
                }

                // Normalize origin (Remove trailing slashes)
                const normalizedOrigin = origin.replace(/\/$/, '');
                const isWhitelisted = whitelist.includes(normalizedOrigin) || whitelist.includes(origin);
                const isDevelopment = env.NODE_ENV === 'development';

                if (isWhitelisted || isDevelopment) {
                    callback(null, true);
                } else {
                    // Log violation with full context
                    Logger.error(`🚨 CORS VIOLATION: Origin "${origin}" is not authorized`, {
                        blockedOrigin: origin,
                        allowedWhitelist: whitelist,
                        environment: env.NODE_ENV
                    });
                    callback(new AppError(`Access Denied by CORS Policy. Origin "${origin}" is not whitelisted.`, httpStatus.FORBIDDEN, 'CORS_ERROR'));
                }
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'Accept',
                'Origin',
                'X-Requested-With',
                'X-Request-ID',
                'X-Refresh-Token',
                'X-CSRF-Token',
                'X-User-Agent',
                'X-App-Version',
                'X-Client-Platform'
            ],
            exposedHeaders: [
                'Content-Range',
                'X-Content-Range',
                'X-Request-ID',
                'X-CSRF-Token'
            ],
            credentials: true,
            optionsSuccessStatus: 200, // Legacy browser support
            maxAge: 86400, // Cache preflight for 24 hours
        })
    );

    //  Prevent parameter pollution (e.g., ?id=1&id=2)
    app.use(hpp());

    // Rate Limiting (Using memory store since MultiLayerCache is not available in boilerplate out of the box)
    const createLimiter = (max, windowMinutes, message) => {
        return rateLimit({
            max,
            windowMs: windowMinutes * 60 * 1000,
            message: {
                status: httpStatus.TOO_MANY_REQUESTS,
                message: message || 'Too many requests, please try again later.',
                code: 'RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false,
            validate: { trustProxy: false }
        });
    };

    // General API Limiter (100 requests per 15 minutes per IP)
    const apiLimiter = createLimiter(100, 15, 'General API rate limit exceeded.');

    // More stringent limiter for specific sensitive endpoints
    const strictLimiter = createLimiter(10, 15, 'Too many attempts. Please try again in 15 minutes.');

    app.use('/api', apiLimiter);
    app.use('/api/v1/contact', strictLimiter); // Applying strict limiter to the contact form as an example
};

module.exports = configureSecurity;
