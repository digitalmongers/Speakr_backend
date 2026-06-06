require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');
const { Post } = require('../src/models/post.model');
const adminUserService = require('../src/services/admin/adminUser.service');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let testUserId = null;
    const testPostIds = [];

    try {
        console.log('Cleaning up existing test data...');
        await User.deleteMany({ username: 'testdetailsuser' });

        console.log('Creating test user...');
        const user = await User.create({
            firstName: 'Details',
            lastName: 'User',
            username: 'testdetailsuser',
            email: 'testdetailsuser@speakr.com',
            password: 'Password123!',
            dob: new Date('1995-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
        });
        testUserId = user._id;

        console.log('Creating posts for test user...');
        // Post 1: Created first (older)
        const post1 = await Post.create({
            title: 'User Post One',
            description: 'This is the older post by this user.',
            audioUrl: 'https://cloudinary.com/post1.mp3',
            audioKey: 'key_post1',
            thumbnailUrl: 'https://cloudinary.com/post1.jpg',
            thumbnailKey: 'thumb_post1',
            category: 'Music',
            language: 'English',
            isKidsContent: false,
            duration: 180, // 3 minutes
            creator: testUserId,
            creatorUsername: user.username,
            createdAt: new Date('2026-06-06T10:00:00Z'),
        });
        testPostIds.push(post1._id);

        // Post 2: Created second (newer)
        const post2 = await Post.create({
            title: 'User Post Two',
            description: 'This is the newer post by this user.',
            audioUrl: 'https://cloudinary.com/post2.mp3',
            audioKey: 'key_post2',
            thumbnailUrl: 'https://cloudinary.com/post2.jpg',
            thumbnailKey: 'thumb_post2',
            category: 'Podcast',
            language: 'English',
            isKidsContent: false,
            duration: 300, // 5 minutes
            creator: testUserId,
            creatorUsername: user.username,
            createdAt: new Date('2026-06-06T11:00:00Z'),
        });
        testPostIds.push(post2._id);

        console.log('1. Testing adminUserService.getUserDetails...');
        const userDetails = await adminUserService.getUserDetails(testUserId);
        console.log('User details fetched:', {
            username: userDetails.username,
            email: userDetails.email,
            totalPosts: userDetails.totalPosts,
        });

        if (userDetails.username !== 'testdetailsuser') {
            throw new Error('Username mismatch');
        }
        if (userDetails.totalPosts !== 2) {
            throw new Error(`Expected totalPosts to be 2, got ${userDetails.totalPosts}`);
        }
        console.log('✅ getUserDetails test passed.');

        console.log('2. Testing adminUserService.getUserPosts (Page 1)...');
        const page1 = await adminUserService.getUserPosts(testUserId, { limit: 1 });
        console.log('Page 1 result:', page1.results.map(p => ({ title: p.title, duration: p.duration, createdAt: p.createdAt })));
        
        if (page1.results.length !== 1) {
            throw new Error(`Expected page 1 to return 1 post, got ${page1.results.length}`);
        }
        if (page1.results[0].title !== 'User Post Two') {
            throw new Error(`Expected newest post 'User Post Two', got '${page1.results[0].title}'`);
        }
        if (page1.results[0].duration !== 300) {
            throw new Error(`Expected duration 300, got ${page1.results[0].duration}`);
        }
        if (!page1.hasNextPage || !page1.nextCursor) {
            throw new Error('Expected page 1 to have next page and next cursor');
        }
        console.log('✅ getUserPosts Page 1 test passed.');

        console.log('3. Testing adminUserService.getUserPosts (Page 2 using cursor)...');
        const page2 = await adminUserService.getUserPosts(testUserId, { limit: 1, cursor: page1.nextCursor });
        console.log('Page 2 result:', page2.results.map(p => ({ title: p.title, duration: p.duration, createdAt: p.createdAt })));

        if (page2.results.length !== 1) {
            throw new Error(`Expected page 2 to return 1 post, got ${page2.results.length}`);
        }
        if (page2.results[0].title !== 'User Post One') {
            throw new Error(`Expected older post 'User Post One', got '${page2.results[0].title}'`);
        }
        if (page2.results[0].duration !== 180) {
            throw new Error(`Expected duration 180, got ${page2.results[0].duration}`);
        }
        console.log('✅ getUserPosts Page 2 test passed.');

        console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('Cleaning up created data...');
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
