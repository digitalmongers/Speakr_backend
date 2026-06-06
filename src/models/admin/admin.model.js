const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { GENDER, REGEX } = require('../../constants');

const adminSchema = mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            default: 'System Admin',
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            validate(value) {
                if (!validator.isEmail(value)) {
                    throw new Error('Invalid email');
                }
            },
        },
        password: {
            type: String,
            required: true,
            trim: true,
            minlength: 8,
            select: false, // hidden unless explicitly selected
        },
        tokenVersion: {
            type: Number,
            default: 0,
            select: false, // hidden unless explicitly selected
        },
        gender: {
            type: String,
            enum: Object.values(GENDER),
            required: false,
        },
        phoneNumber: {
            type: String,
            required: false,
            trim: true,
            validate(value) {
                if (value && !value.match(REGEX.PHONE)) {
                    throw new Error('Invalid phone number format');
                }
            },
        },
        profilePic: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

/**
 * Check if password matches the admin's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
adminSchema.methods.isPasswordMatch = async function (password) {
    const admin = this;
    return bcrypt.compare(password, admin.password);
};

adminSchema.pre('save', async function (next) {
    const admin = this;
    if (admin.isModified('password')) {
        // Check if the password is already a bcrypt hash to prevent double hashing
        const isBcrypt = admin.password && admin.password.startsWith('$2') && admin.password.length === 60;
        if (!isBcrypt) {
            admin.password = await bcrypt.hash(admin.password, 12);
        }
    }
    next();
});

/**
 * @typedef Admin
 */
const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
