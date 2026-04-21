const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');
const ApiResponse = require('../utils/ApiResponse');
const { SUCCESS_MESSAGES } = require('../constants');

const signup = catchAsync(async (req, res) => {
    await authService.initiateSignup(req.body);
    
    return res.status(httpStatus.ACCEPTED).json(
        new ApiResponse(
            httpStatus.ACCEPTED,
            null,
            'Details received. A 6-digit OTP has been sent to your email for verification.'
        )
    );
});

const verifyOtp = catchAsync(async (req, res) => {
    const { email, otp } = req.body;
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

    return res.status(httpStatus.CREATED).json(
        new ApiResponse(
            httpStatus.CREATED,
            { user: userResponse, tokens },
            'Account verified and created successfully. Welcome to Speakr!'
        )
    );
});

const login = catchAsync(async (req, res) => {
    const { identifier, password } = req.body;
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

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            { user: userResponse, tokens },
            SUCCESS_MESSAGES.LOGIN_SUCCESS
        )
    );
});

const logout = catchAsync(async (req, res) => {
    await authService.logout(req.user._id);
    return res.status(httpStatus.OK).json(
        new ApiResponse(httpStatus.OK, null, 'Logged out successfully from all devices.')
    );
});

module.exports = {
    signup,
    verifyOtp,
    login,
    logout,
};
