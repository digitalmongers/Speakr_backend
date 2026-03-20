/**
 * ENTERPRISE-GRADE GLOBAL CONSTANTS
 * Centralized configuration for status codes, messages, and patterns.
 */

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
};

// Error Messages - Grouped by domain for better granularity
const ERROR_MESSAGES = {
    // Client Side Errors
    BAD_REQUEST: 'The request could not be understood or was missing required parameters.',
    UNAUTHORIZED: 'Authentication is required to access this resource.',
    FORBIDDEN: 'You do not have permission to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    CONFLICT: 'A conflict occurred with the current state of the resource.',
    TOO_MANY_REQUESTS: 'Rate limit exceeded. Please try again later.',

    // Validation & Logic Errors
    VALIDATION_ERROR: 'One or more fields failed validation.',
    INVALID_CREDENTIALS: 'The email or password provided is incorrect.',
    TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
    INVALID_TOKEN: 'The provided authentication token is invalid or malformed.',
    DUPLICATE_RESOURCE: 'This resource already exists in our system.',

    // Server Side Errors
    INTERNAL_ERROR: 'An unexpected error occurred on our end. Please try again later.',
    SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. We are working on it!',
};

// Success Messages
const SUCCESS_MESSAGES = {
    FETCHED: 'Resource(s) retrieved successfully.',
    CREATED: 'Resource created successfully.',
    UPDATED: 'Resource updated successfully.',
    DELETED: 'Resource deleted successfully.',
    LOGIN_SUCCESS: 'Authentication successful. Welcome back!',
    LOGOUT_SUCCESS: 'Logged out successfully.',
    REGISTER_SUCCESS: 'Account created successfully.',
    OPERATION_SUCCESS: 'The operation was completed successfully.',
};

// Application Config
const CONFIG = {
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 10,
        MAX_LIMIT: 100,
    },
    RATE_LIMIT: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_API_REQUESTS: 100,
        MAX_STRICT_REQUESTS: 10,
    },
    SECURITY: {
        BCRYPT_SALT_ROUNDS: 12,
        JWT_EXPIRES_IN: '90d',
        COOKIE_EXPIRES_IN: 90,
    },
};

// Environments
const ENV = {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production',
    TEST: 'test',
};

const REGEX = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    // Relaxed phone regex to allow international formats like (555) 123-4567
    PHONE: /^[\d\s()+-]{7,20}$/,
    // Minimum eight characters, at least one uppercase letter, one lowercase letter, one number and one special character
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#.])[A-Za-z\d@$!%*?&#.]{8,}$/,
    MONGODB_ID: /^[0-9a-fA-F]{24}$/,
};


const ROLES = {
    ADMIN: 'admin',
    USER: 'user',
};


const SYSTEM_MODE = {
    LIVE: 'live',
    MAINTENANCE: 'maintenance'
};


module.exports = {
    HTTP_STATUS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    CONFIG,
    ENV,
    REGEX,
    ROLES,
    SYSTEM_MODE
};
