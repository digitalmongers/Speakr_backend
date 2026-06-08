const mongoose = require('mongoose');

const languageSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Language name is required'],
            unique: true,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

languageSchema.index({ isActive: 1 });

const Language = mongoose.model('Language', languageSchema);

module.exports = Language;
