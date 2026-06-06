const httpStatus = require('http-status').default;
const catchAsync = require('../../utils/catchAsync');
const adminUserService = require('../../services/admin/adminUser.service');
const ApiResponse = require('../../utils/ApiResponse');
const AuditService = require('../../services/audit.service');

/**
 * Get list of verified users (Admin access only)
 */
const getVerifiedUsers = catchAsync(async (req, res) => {
    const { limit, cursor, search } = req.query;

    const usersData = await adminUserService.listVerifiedUsers({
        limit,
        cursor,
        search,
    });

    AuditService.record({
        action: 'ADMIN_GET_USERS_LIST',
        entity: 'Admin',
        entityId: req.admin._id,
        userId: req.admin._id,
        metadata: { limit, cursor, search },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            usersData,
            'Verified users list retrieved successfully.'
        )
    );
});

/**
 * Toggle user block status (Admin access only)
 */
const toggleBlock = catchAsync(async (req, res) => {
    const { userId } = req.params;

    const result = await adminUserService.toggleUserBlock(userId);

    AuditService.record({
        action: 'ADMIN_TOGGLE_USER_BLOCK',
        entity: 'User',
        entityId: userId,
        userId: req.admin._id,
        metadata: { isBlocked: result.isBlocked },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            result,
            `User has been successfully ${result.isBlocked ? 'blocked' : 'unblocked'}.`
        )
    );
});

/**
 * Delete user account and cascade delete all associated data (Admin access only)
 */
const deleteUser = catchAsync(async (req, res) => {
    const { userId } = req.params;

    await adminUserService.deleteUser(userId);

    AuditService.record({
        action: 'ADMIN_DELETE_USER',
        entity: 'User',
        entityId: userId,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            null,
            'User account and all associated posts, comments, replies, and reactions have been permanently deleted.'
        )
    );
});

/**
 * Get detailed profile of a specific user (Admin access only)
 */
const getUserDetails = catchAsync(async (req, res) => {
    const { userId } = req.params;

    const userDetails = await adminUserService.getUserDetails(userId);

    AuditService.record({
        action: 'ADMIN_GET_USER_DETAILS',
        entity: 'User',
        entityId: userId,
        userId: req.admin._id,
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            userDetails,
            'User details retrieved successfully.'
        )
    );
});

/**
 * Get posts of a specific user with cursor-based pagination (Admin access only)
 */
const getUserPosts = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { limit, cursor } = req.query;

    const postsData = await adminUserService.getUserPosts(userId, { limit, cursor });

    AuditService.record({
        action: 'ADMIN_GET_USER_POSTS',
        entity: 'User',
        entityId: userId,
        userId: req.admin._id,
        metadata: { limit, cursor },
    });

    return res.status(httpStatus.OK).json(
        new ApiResponse(
            httpStatus.OK,
            postsData,
            'User posts retrieved successfully.'
        )
    );
});

module.exports = {
    getVerifiedUsers,
    toggleBlock,
    deleteUser,
    getUserDetails,
    getUserPosts,
};
