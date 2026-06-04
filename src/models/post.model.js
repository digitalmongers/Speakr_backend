const mongoose = require('mongoose');
const { POST_CATEGORIES: CATEGORIES, POST_LANGUAGES: LANGUAGES } = require('../constants');

const postSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Post title is required'],
            trim: true,
            minlength: [3, 'Title must be at least 3 characters'],
            maxlength: [100, 'Title cannot exceed 100 characters'],
        },
        description: {
            type: String,
            required: [true, 'Post description is required'],
            trim: true,
            minlength: [10, 'Description must be at least 10 characters'],
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
        },
        audioUrl: {
            type: String,
            required: [true, 'Audio URL is required'],
            trim: true,
        },
        audioKey: {
            type: String,
            required: [true, 'Audio storage key is required'],
            trim: true,
        },
        thumbnailUrl: {
            type: String,
            required: [true, 'Thumbnail URL is required'],
            trim: true,
        },
        thumbnailKey: {
            type: String,
            required: [true, 'Thumbnail storage key is required'],
            trim: true,
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            enum: {
                values: CATEGORIES,
                message: 'Invalid category: {VALUE}',
            },
        },
        language: {
            type: String,
            required: [true, 'Language is required'],
            enum: {
                values: LANGUAGES,
                message: 'Invalid language: {VALUE}',
            },
        },
        isKidsContent: {
            type: Boolean,
            required: true,
            default: false,
        },
        duration: {
            type: Number,
            required: [true, 'Audio duration is required'],
            min: [0, 'Duration cannot be negative'],
            default: 0,
        },
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Creator reference is required'],
        },
        creatorUsername: {
            type: String,
            required: [true, 'Creator username is required'],
            trim: true,
            lowercase: true,
        },
        likesCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        dislikesCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        savesCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        listensCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        commentsCount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Compound Indexes for Enterprise-Grade Query Optimization (as per .cursorfiles rules)
postSchema.index({ creator: 1, createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });
postSchema.index({ language: 1, createdAt: -1 });
postSchema.index({ isKidsContent: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

// Full-Text Search Index for Blazing-Fast Global Search (relevance ranked)
postSchema.index(
    { title: 'text', description: 'text', category: 'text', language: 'text' },
    { 
        weights: { title: 10, description: 3, category: 2, language: 1 },
        language_override: 'none'
    }
);

const Post = mongoose.model('Post', postSchema);

module.exports = {
    Post,
    CATEGORIES,
    LANGUAGES
};
