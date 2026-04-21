const User = require('../models/user.model');

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
    return User.findOne({ email }).lean();
};

/**
 * Get user by ID
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
    return User.findById(id).lean();
};

/**
 * Get user by username
 * @param {string} username
 * @returns {Promise<User>}
 */
const getUserByUsername = async (username) => {
    return User.findOne({ username }).lean();
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
    return User.findOne({ verificationToken: token });
};

module.exports = {
    getUserByEmail,
    getUserById,
    getUserByUsername,
    createUser,
    updateUserById,
    getUserByVerificationToken,
};
