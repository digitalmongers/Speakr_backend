const userService = require("../services/user.service");
const ApiResponse = require("../utils/ApiResponse");
const catchAsync = require("../utils/catchAsync");
const httpStatus = require("http-status").default;
const AppError = require("../utils/AppError");

const getMyProfile = catchAsync(async (req, res) => {
  if (!req.user || !req.user._id) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Please authenticate");
  }
  const userId = req.user._id;
  const profile = await userService.getMyProfileService(userId);

  return res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      profile,
      "My profile fetched successfully"
    )
  );
});

const getPublicProfile = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const requesterId = req.user?._id;
  const profile = await userService.getPublicProfileService(userId, requesterId);

  return res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      profile,
      "Public profile fetched successfully"
    )
  );
});

const updateProfile = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const updatedUser = await userService.updateProfileService(
    userId,
    req.body
  );

  return res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      updatedUser,
      "Profile updated successfully"
    )
  );
});

module.exports = {
  getMyProfile,
  getPublicProfile,
  updateProfile,
};