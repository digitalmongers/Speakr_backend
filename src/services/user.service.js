const userRepository = require("../repositories/user.repository");

const getProfileService = async (userId) => {
  const user =
    await userRepository.getPublicProfile(userId);

  return user;
};
const updateProfileService = async (
  userId,
  updateData
) => {
  return userRepository.updateProfile(
    userId,
    updateData
  );
};

module.exports = {
  getProfileService,
  updateProfileService,
};