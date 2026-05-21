const userRepository = require("../repositories/user.repository");
const UploadService = require("./upload.service");
const Logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const httpStatus = require("http-status").default;

const getMyProfileService = async (userId) => {
  const user = await userRepository.getPrivateProfile(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User profile not found");
  }
  return user;
};

const getPublicProfileService = async (userId, requesterId = null) => {
  const isOwner = requesterId && userId && requesterId.toString() === userId.toString();
  const user = isOwner
    ? await userRepository.getPrivateProfile(userId)
    : await userRepository.getPublicProfile(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User profile not found");
  }
  return user;
};

const updateProfileService = async (
  userId,
  updateData
) => {
  // If user is updating their profile picture, handle old file cleanup
  if (updateData.profilePic !== undefined) {
    const existingUser = await userRepository.getPrivateProfile(userId);
    if (!existingUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const oldPic = existingUser.profilePic;
    const newPic = updateData.profilePic;

    // Check if user is updating/replacing an existing photo
    if (oldPic && oldPic !== newPic) {
      const oldKey = UploadService.extractKeyFromUrl(oldPic);
      if (oldKey) {
        try {
          Logger.info("Cleaning up old user profile picture from storage", { userId, oldKey });
          await UploadService.deleteFromS3(oldKey);
        } catch (storageError) {
          // Log the error but do not block the profile update
          Logger.error("Failed to delete old profile picture from storage", {
            userId,
            oldKey,
            error: storageError.message,
          });
        }
      }
    }
  }

  const updatedUser = await userRepository.updateProfile(
    userId,
    updateData
  );
  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  return updatedUser;
};


module.exports = {
  getMyProfileService,
  getPublicProfileService,
  updateProfileService,
};