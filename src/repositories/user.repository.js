const User = require('../models/user.model');

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
    return User.findOne({ email }).select('-password').lean();
};

/**
 * Get user by ID
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
    return User.findById(id).select('-password').lean();
};

/**
 * Get user by username
 * @param {string} username
 * @returns {Promise<User>}
 */
const getUserByUsername = async (username) => {
    return User.findOne({ username }).select('-password').lean();
};

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
    return User.create(userBody);
};

/**
 * Update user by ID
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody) => {
    const user = await User.findById(userId);
    if (!user) return null;
    
    // Prevent role from being updated through this method
    if (updateBody.role) {
        delete updateBody.role;
    }
    
    Object.assign(user, updateBody);
    await user.save();
    return user;
};

/**
 * Get user by verification token
 * @param {string} token
 * @returns {Promise<User>}
 */
const getUserByVerificationToken = async (token) => {
    return User.findOne({ verificationToken: token }).select('-password').lean();
};

/**
 * Get user specifically for session validation
 * Optimized projection: only fetch what's needed for middleware (role, tokenVersion)
 * @param {ObjectId} id
 * @returns {Promise<Object>}
 */
const getUserForSession = async (id) => {
    return User.findById(id).select('role tokenVersion').lean();
};

const getPublicProfile = async (userId) => {
  return User.findById(userId)
    .select('firstName lastName username bio city profilePic _id')
    .lean();
};

const getPrivateProfile = async (userId) => {
  return User.findById(userId)
    .select('-password -tokenVersion')
    .lean();
};

const updateProfile = async (
  userId,
  updateData
) => {
  // Sanitize input to prevent sensitive/internal fields from being updated here
  const safeUpdate = { ...updateData };
  delete safeUpdate.role;
  delete safeUpdate.email;
  delete safeUpdate.password;
  delete safeUpdate.isEmailVerified;
  delete safeUpdate.tokenVersion;

  return User.findByIdAndUpdate(
    userId,
    {
      $set: safeUpdate,
    },
    {
      new: true,
      runValidators: true,
      select:
        "firstName lastName username bio gender city profilePic",
    }
  ).lean();
};


module.exports = {
    getUserByEmail,
    getUserById,
    getUserByUsername,
    createUser,
    updateUserById,
    getUserByVerificationToken,
    getUserForSession,
    getPublicProfile,
    getPrivateProfile,
    updateProfile,
};

