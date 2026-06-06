require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');
const { Post } = require('../src/models/post.model');
const authService = require('../src/services/auth.service');
const adminUserService = require('../src/services/admin/adminUser.service');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let testUserId = null;
    const testPostIds = [];

    try {
        console.log('Cleaning up existing test data...');
        await User.deleteMany({ username: 'testactivityuser' });

        console.log('1. Creating test user (representing OTP verification sign-up)...');
        const user = await User.create({
            firstName: 'Activity',
            lastName: 'User',
            username: 'testactivityuser',
            email: 'testactivityuser@speakr.com',
            password: 'Password123!',
            dob: new Date('1995-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
            lastLogin: new Date(Date.now() - 3600 * 1000), // Set to 1 hour ago
        });
        testUserId = user._id;
        console.log('Initial lastLogin time set:', user.lastLogin);

        console.log('Creating posts for user...');
        const post1 = await Post.create({
            title: 'Activity Post 1',
            description: 'Testing activity post.',
            audioUrl: 'https://cloudinary.com/dummy.mp3',
            audioKey: 'key_act1',
            thumbnailUrl: 'https://cloudinary.com/dummy.jpg',
            thumbnailKey: 'thumb_act1',
            category: 'Music',
            language: 'English',
            isKidsContent: false,
            creator: testUserId,
            creatorUsername: user.username,
        });
        testPostIds.push(post1._id);

        const post2 = await Post.create({
            title: 'Activity Post 2',
            description: 'Testing activity post 2.',
            audioUrl: 'https://cloudinary.com/dummy.mp3',
            audioKey: 'key_act2',
            thumbnailUrl: 'https://cloudinary.com/dummy.jpg',
            thumbnailKey: 'thumb_act2',
            category: 'Music',
            language: 'English',
            isKidsContent: false,
            creator: testUserId,
            creatorUsername: user.username,
        });
        testPostIds.push(post2._id);

        console.log('2. Simulating user login to update lastLogin...');
        const loggedInUser = await authService.login('testactivityuser@speakr.com', 'Password123!');
        const updatedUser = await User.findById(testUserId);
        console.log('Updated lastLogin time:', updatedUser.lastLogin);

        if (!updatedUser.lastLogin) {
            throw new Error('lastLogin was not populated');
        }
        if (updatedUser.lastLogin.getTime() <= user.lastLogin.getTime()) {
            throw new Error('lastLogin time did not increment upon login');
        }
        console.log('✅ lastLogin successfully updated upon login.');

        console.log('3. Fetching verified users list as admin...');
        const res = await adminUserService.listVerifiedUsers({ limit: 10 });
        const listUser = res.results.find(u => u.username === 'testactivityuser');

        if (!listUser) {
            throw new Error('testactivityuser was not returned in listVerifiedUsers');
        }

        console.log('List verified user record:', {
            username: listUser.username,
            createdAt: listUser.createdAt,
            lastLogin: listUser.lastLogin,
            postsCount: listUser.postsCount,
        });

        if (!listUser.createdAt) {
            throw new Error('createdAt is missing from list');
        }
        if (!listUser.lastLogin) {
            throw new Error('lastLogin is missing from list');
        }
        if (listUser.postsCount !== 2) {
            throw new Error(`Expected postsCount to be 2, got ${listUser.postsCount}`);
        }
        console.log('✅ listVerifiedUsers correctly returns createdAt, lastLogin, and postsCount.');

        console.log('🎉 ALL USER ACTIVITY TESTS PASSED SUCCESSFULLY! 🎉');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('Cleaning up test data...');
        if (testPostIds.length > 0) {
            await Post.deleteMany({ _id: { $in: testPostIds } });
        }
        if (testUserId) {
            await User.findByIdAndDelete(testUserId);
        }
        console.log('Closing MongoDB Connection...');
        await mongoose.connection.close();
        console.log('MongoDB Connection closed.');
    }
};

runTest();
