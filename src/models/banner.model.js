const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
    {
        imageUrl: {
            type: String,
            required: [true, 'Banner image URL is required'],
            trim: true,
        },
        imageKey: {
            type: String,
            required: [true, 'Banner image key is required'],
            trim: true,
        },
        redirectUrl: {
            type: String,
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

// Indexing for active banners and sorting by creation date
bannerSchema.index({ isActive: 1, createdAt: -1 });

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;
