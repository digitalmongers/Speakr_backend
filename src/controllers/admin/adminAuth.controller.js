const httpStatus = require('http-status').default;
const catchAsync = require('../../utils/catchAsync');
const adminAuthService = require('../../services/admin/adminAuth.service');
const ApiResponse = require('../../utils/ApiResponse');
const AuditService = require('../../services/audit.service');
const { SUCCESS_MESSAGES } = require('../../constants');

/**
 * Controller for handling Admin Authentication requests.
 */
const login = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    try {
        const { admin, tokens } = await adminAuthService.login(email, password);

        await AuditService.record({
            action: 'ADMIN_LOGIN_SUCCESS',
            entity: 'Admin',
            entityId: admin.id,
            userId: admin.id,
            metadata: { email: admin.email },
        });

        return res.status(httpStatus.OK).json(
            new ApiResponse(
                httpStatus.OK,
                { admin, tokens },
                SUCCESS_MESSAGES.LOGIN_SUCCESS
            )
        );
    } catch (error) {
        await AuditService.record({
            action: 'ADMIN_LOGIN_FAILURE',
            status: 'FAILURE',
            metadata: { email },
            error: error.message,
        });
        throw error;
    }
});

const logout = catchAsync(async (req, res) => {
    const adminId = req.admin._id;
    await adminAuthService.logout(adminId);

    await AuditService.record({
        action: 'ADMIN_LOGOUT',
        entity: 'Admin',
        entityId: adminId,
        userId: adminId,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            SUCCESS_MESSAGES.LOGOUT_SUCCESS
        )
    );
});

const getProfile = catchAsync(async (req, res) => {
    const admin = req.admin;
    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            {
                admin: {
                    id: admin._id,
                    email: admin.email,
                    fullName: admin.fullName,
                    gender: admin.gender,
                    phoneNumber: admin.phoneNumber,
                    profilePic: admin.profilePic,
                }
            },
            'Admin profile retrieved successfully.'
        )
    );
});

const updateProfile = catchAsync(async (req, res) => {
    const adminId = req.admin._id;
    const updatedAdmin = await adminAuthService.updateProfile(adminId, req.body);

    await AuditService.record({
        action: 'ADMIN_PROFILE_UPDATE',
        entity: 'Admin',
        entityId: adminId,
        userId: adminId,
        metadata: { updatedFields: Object.keys(req.body) },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            { admin: updatedAdmin },
            'Admin profile updated successfully.'
        )
    );
});

const forgotPassword = catchAsync(async (req, res) => {
    const { email } = req.body;
    const result = await adminAuthService.requestForgotPassword(email);

    await AuditService.record({
        action: 'ADMIN_FORGOT_PASSWORD_REQUEST',
        metadata: { email },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            result.message
        )
    );
});

const verifyOtp = catchAsync(async (req, res) => {
    const { email, otp } = req.body;
    const { resetToken } = await adminAuthService.verifyForgotPasswordOtp(email, otp);

    await AuditService.record({
        action: 'ADMIN_OTP_VERIFICATION',
        metadata: { email },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            { resetToken },
            'Verification code verified successfully. You can now reset your password.'
        )
    );
});

const resetPassword = catchAsync(async (req, res) => {
    const { email, resetToken, newPassword } = req.body;
    const result = await adminAuthService.resetPassword(email, resetToken, newPassword);

    await AuditService.record({
        action: 'ADMIN_PASSWORD_RESET_SUCCESS',
        metadata: { email },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            result.message
        )
    );
});

const changePassword = catchAsync(async (req, res) => {
    const adminId = req.admin._id;
    const { currentPassword, newPassword } = req.body;
    const result = await adminAuthService.changePassword(adminId, currentPassword, newPassword);

    await AuditService.record({
        action: 'ADMIN_PASSWORD_CHANGE',
        entity: 'Admin',
        entityId: adminId,
        userId: adminId,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            result.message
        )
    );
});

module.exports = {
    login,
    logout,
    getProfile,
    updateProfile,
    forgotPassword,
    verifyOtp,
    resetPassword,
    changePassword,
};
