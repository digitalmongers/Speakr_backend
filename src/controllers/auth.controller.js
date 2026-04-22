const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');
const ApiResponse = require('../utils/ApiResponse');
const AuditService = require('../services/audit.service');
const { SUCCESS_MESSAGES } = require('../constants');

const signup = catchAsync(async (req, res) => {
    const { email } = req.body;
    try {
        await authService.initiateSignup(req.body);
        
        await AuditService.record({
            action: 'AUTH_SIGNUP_INITIATED',
            metadata: { email }
        });

    
        return res.status(httpStatus.ACCEPTED).json(
            new ApiResponse(
                httpStatus.ACCEPTED,
                null,
                'Details received. A 6-digit OTP has been sent to your email for verification.'
            )
        );
    } catch (error) {
        await AuditService.record({
            action: 'AUTH_SIGNUP_INIT_FAILURE',
            status: 'FAILURE',
            metadata: { email },
            error: error.message
        });
        throw error;
    }
});

const verifyOtp = catchAsync(async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await authService.verifyOTPAndCreateUser(email, otp);
        
        const tokens = await tokenService.generateAuthTokens(user);
    
    const userResponse = {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
    };

    await AuditService.record({
        action: 'AUTH_SIGNUP_COMPLETED',
        entity: 'User',
        entityId: user._id,
        userId: user._id,
        metadata: { email: user.email }
    });

        return res.status(httpStatus.CREATED).json(
            new ApiResponse(
                httpStatus.CREATED,
                { user: userResponse, tokens },
                'Account verified and created successfully. Welcome to Speakr!'
            )
        );
    } catch (error) {
        await AuditService.record({
            action: 'AUTH_SIGNUP_COMPLETION_FAILURE',
            status: 'FAILURE',
            metadata: { email },
            error: error.message
        });
        throw error;
    }
});

const login = catchAsync(async (req, res) => {
    const { identifier, password } = req.body;
    
    try {
        const user = await authService.login(identifier, password);
        const tokens = await tokenService.generateAuthTokens(user);
        
        const userResponse = {
            id: user._id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
        };

        await AuditService.record({
            action: 'AUTH_LOGIN_SUCCESS',
            entity: 'User',
            entityId: user._id,
            userId: user._id,
            metadata: { email: user.email, username: user.username }
        });

        return res.status(httpStatus.OK).json(
            new ApiResponse(
                httpStatus.OK,
                { user: userResponse, tokens },
                SUCCESS_MESSAGES.LOGIN_SUCCESS
            )
        );
    } catch (error) {
        await AuditService.record({
            action: 'AUTH_LOGIN_FAILURE',
            status: 'FAILURE',
            metadata: { identifier },
            error: error.message
        });
        throw error;
    }
});

const logout = catchAsync(async (req, res) => {
    const userId = req.user._id;
    await authService.logout(userId);

    await AuditService.record({
        action: 'AUTH_LOGOUT',
        userId: userId
    });

    return res.status(httpStatus.OK).json(

        new ApiResponse(httpStatus.OK, null, 'Logged out successfully from all devices.')
    );
});

const resendOtp = catchAsync(async (req, res) => {
    const { email } = req.body;
    await authService.resendOTP(email);

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            'A new verification code has been sent to your email.'
        )
    );
});

module.exports = {
    signup,
    verifyOtp,
    resendOtp,
    login,
    logout,
};
