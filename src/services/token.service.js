const jwt = require('jsonwebtoken');
const moment = require('moment');
const crypto = require('crypto');

/**
 * Generate token
 * @param {ObjectId} userId
 * @param {number} version
 * @param {Moment} expires
 * @param {string} [secret]
 * @returns {string}
 */
const generateToken = (userId, version, expires, secret = process.env.JWT_SECRET) => {
    const payload = {
        sub: userId,
        v: version, // Token Version
        iat: moment().unix(),
        exp: expires.unix(),
    };
    return jwt.sign(payload, secret);
};

/**
 * Generate auth tokens
 * @param {Object} user
 * @returns {Promise<Object>}
 */
const generateAuthTokens = async (user) => {
    const accessTokenExpires = moment().add(process.env.JWT_ACCESS_EXPIRATION_MINUTES, 'minutes');
    const accessToken = generateToken(user._id, user.tokenVersion, accessTokenExpires);

    const refreshTokenExpires = moment().add(process.env.JWT_REFRESH_EXPIRATION_DAYS, 'days');
    const refreshToken = generateToken(user._id, user.tokenVersion, refreshTokenExpires);

    return {
        access: {
            token: accessToken,
            expires: accessTokenExpires.toDate(),
        },
        refresh: {
            token: refreshToken,
            expires: refreshTokenExpires.toDate(),
        },
    };
};

/**
 * Generate verification token
 * @returns {string}
 */
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Verify token and return payload
 * @param {string} token
 * @param {string} [secret]
 * @returns {Object}
 */
const verifyToken = (token, secret = process.env.JWT_SECRET) => {
    return jwt.verify(token, secret);
};

/**
 * Generate 6-digit OTP
 * @returns {string}
 */
const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

module.exports = {
    generateToken,
    generateAuthTokens,
    generateVerificationToken,
    verifyToken,
    generateOTP,
};
