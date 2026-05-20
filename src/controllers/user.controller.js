const userService = require("../services/user.service");

const ApiResponse = require("../utils/ApiResponse");

const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const profile =
      await userService.getProfileService(userId);

    return res.status(200).json(
      new ApiResponse(
        200,
        profile,
        "Profile fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

const getPublicProfile = async (
  req,
  res,
  next
) => {
  try {
    const { userId } = req.params;

    const profile =
      await userService.getProfileService(userId);

    return res.status(200).json(
      new ApiResponse(
        200,
        profile,
        "Profile fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user._id;

    const updatedUser =
      await userService.updateProfileService(
        userId,
        req.body
      );

    return res.status(200).json(
      new ApiResponse(
        200,
        updatedUser,
        "Profile updated successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  getPublicProfile,
  updateProfile,
};