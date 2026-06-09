require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');
const Admin = require('../src/models/admin/admin.model');
const { Post } = require('../src/models/post.model');
const { Comment } = require('../src/models/comment.model');
const postService = require('../src/services/post.service');
const AppError = require('../src/utils/AppError');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let userId = null;
    let otherUserId = null;
    let adminId = null;
    let post1Id = null;
    let post2Id = null;

    try {
        console.log('Cleaning up existing test data...');
        await User.deleteMany({ username: { $in: ['testuserdelete', 'otheruserdelete'] } });
        await Admin.deleteMany({ email: 'testadmindelete@speakr.com' });

        console.log('Creating test users...');
        const user = await User.create({
            firstName: 'Test',
            lastName: 'User',
            username: 'testuserdelete',
            email: 'testuserdelete@speakr.com',
            password: 'Password123!',
            dob: new Date('1990-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
        });
        userId = user._id;

        const otherUser = await User.create({
            firstName: 'Other',
            lastName: 'User',
            username: 'otheruserdelete',
            email: 'otheruserdelete@speakr.com',
            password: 'Password123!',
            dob: new Date('1990-01-01'),
            gender: 'female',
            role: 'user',
            isEmailVerified: true,
        });
        otherUserId = otherUser._id;

        console.log('Creating test admin...');
        const admin = await Admin.create({
            name: 'Test Admin',
            email: 'testadmindelete@speakr.com',
            password: 'Password123!',
            role: 'superadmin',
        });
        adminId = admin._id;

        console.log('Creating posts...');
        const post1 = await Post.create({
            title: 'Post 1 of Test User',
            description: 'This is post 1.',
            audioUrl: 'https://speakr.com/dummy.mp3',
            audioKey: 'dummy_audio_key_1',
            thumbnailUrl: 'https://speakr.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_1',
            category: 'Music',
            language: 'English',
            isKidsContent: false,
            creator: userId,
            creatorUsername: user.username,
        });
        post1Id = post1._id;

        const post2 = await Post.create({
            title: 'Post 2 of Test User',
            description: 'This is post 2.',
            audioUrl: 'https://speakr.com/dummy.mp3',
            audioKey: 'dummy_audio_key_2',
            thumbnailUrl: 'https://speakr.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_2',
            category: 'Podcast',
            language: 'English',
            isKidsContent: false,
            creator: userId,
            creatorUsername: user.username,
        });
        post2Id = post2._id;

        console.log('Test Case 1: Unauthorized deletion attempt (other user tries to delete Post 1)...');
        try {
            await postService.deletePost(post1Id, otherUserId, false);
            throw new Error('Test Case 1 Failed: Other user was able to delete the post!');
        } catch (error) {
            if (error instanceof AppError && error.statusCode === 403) {
                console.log('✅ Test Case 1 Passed: Unauthorized deletion blocked with 403 Forbidden.');
            } else {
                throw error;
            }
        }

        console.log('Test Case 2: Admin deletes Post 1...');
        const deleteRes1 = await postService.deletePost(post1Id, adminId, true);
        if (!deleteRes1) {
            throw new Error('Test Case 2 Failed: postService.deletePost returned false');
        }
        const deletedPost1 = await Post.findById(post1Id);
        if (deletedPost1) {
            throw new Error('Test Case 2 Failed: Post 1 still exists in DB after admin delete!');
        }
        console.log('✅ Test Case 2 Passed: Admin successfully deleted the post.');

        console.log('Test Case 3: Creator deletes Post 2...');
        const deleteRes2 = await postService.deletePost(post2Id, userId, false);
        if (!deleteRes2) {
            throw new Error('Test Case 3 Failed: postService.deletePost returned false');
        }
        const deletedPost2 = await Post.findById(post2Id);
        if (deletedPost2) {
            throw new Error('Test Case 3 Failed: Post 2 still exists in DB after creator delete!');
        }
        console.log('✅ Test Case 3 Passed: Creator successfully deleted their own post.');

        console.log('🎉 ALL ADMIN AND USER POST DELETION TESTS PASSED SUCCESSFULLY! 🎉');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('Cleaning up remaining test data...');
        if (userId) await User.findByIdAndDelete(userId);
        if (otherUserId) await User.findByIdAndDelete(otherUserId);
        if (adminId) await Admin.findByIdAndDelete(adminId);
        if (post1Id) await Post.findByIdAndDelete(post1Id);
        if (post2Id) await Post.findByIdAndDelete(post2Id);
        
        console.log('Closing MongoDB connection...');
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

runTest();
