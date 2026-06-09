require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');
const Admin = require('../src/models/admin/admin.model');
const { Post } = require('../src/models/post.model');
const Category = require('../src/models/category.model');
const Language = require('../src/models/language.model');
const adminPostController = require('../src/controllers/admin/adminPost.controller');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let userId = null;
    let adminId = null;
    let post1Id = null;
    let post2Id = null;

    try {
        console.log('Cleaning up existing test data...');
        await User.deleteMany({ username: 'repuser' });
        await Admin.deleteMany({ email: 'repadmin@speakr.com' });
        await Category.deleteMany({ name: 'Music' });
        await Language.deleteMany({ name: 'English' });

        console.log('Creating reference category and language...');
        await Category.create({ name: 'Music', isActive: true });
        await Language.create({ name: 'English', isActive: true });

        console.log('Creating test user...');
        const user = await User.create({
            firstName: 'Reporting',
            lastName: 'User',
            username: 'repuser',
            email: 'repuser@speakr.com',
            password: 'Password123!',
            dob: new Date('1990-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
        });
        userId = user._id;

        console.log('Creating test admin...');
        const admin = await Admin.create({
            name: 'Rep Admin',
            email: 'repadmin@speakr.com',
            password: 'Password123!',
            role: 'superadmin',
        });
        adminId = admin._id;

        console.log('Creating posts (one kids, one general)...');
        const post1 = await Post.create({
            title: 'Kids Post',
            description: 'Kids friendly content.',
            audioUrl: 'https://speakr.com/dummy.mp3',
            audioKey: 'dummy_audio_key_kids',
            thumbnailUrl: 'https://speakr.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_kids',
            category: 'Music',
            language: 'English',
            isKidsContent: true,
            status: 'pending', // default for admin query list filter
            creator: userId,
            creatorUsername: user.username,
        });
        post1Id = post1._id;

        const post2 = await Post.create({
            title: 'General Post',
            description: 'General zone content.',
            audioUrl: 'https://speakr.com/dummy.mp3',
            audioKey: 'dummy_audio_key_general',
            thumbnailUrl: 'https://speakr.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_general',
            category: 'Music',
            language: 'English',
            isKidsContent: false,
            status: 'approved',
            creator: userId,
            creatorUsername: user.username,
        });
        post2Id = post2._id;

        // Promise wrapper to run controllers and handle async execution wrapped by catchAsync
        const runController = (controllerFn, req) => {
            return new Promise((resolve, reject) => {
                const res = {
                    status(code) {
                        this.statusCode = code;
                        return this;
                    },
                    json(data) {
                        this.data = data;
                        resolve(this);
                        return this;
                    }
                };
                const next = (err) => {
                    if (err) reject(err);
                    else resolve(res);
                };
                controllerFn(req, res, next);
            });
        };

        console.log('Test Case 1: Testing queryAdminPosts (Kids content list)...');
        const req1 = {
            query: { page: '1', limit: '10', status: 'pending' },
            admin: admin,
        };
        const res1 = await runController(adminPostController.queryAdminPosts, req1);

        if (res1.statusCode !== 200) {
            throw new Error(`queryAdminPosts failed with status code ${res1.statusCode}`);
        }
        
        const posts1 = res1.data.data.results;
        const testPost1 = posts1.find(p => p._id.toString() === post1Id.toString());
        if (!testPost1) {
            throw new Error('Kids post not found in queryAdminPosts results.');
        }

        console.log('Checking Creator Details on Kids Post:', testPost1.creator);
        if (!testPost1.creator || typeof testPost1.creator !== 'object') {
            throw new Error('Creator field was not populated to an object.');
        }
        if (testPost1.creator.firstName !== 'Reporting' || testPost1.creator.lastName !== 'User' || testPost1.creator.username !== 'repuser') {
            throw new Error('Creator details on queryAdminPosts did not match test user values!');
        }
        if (!testPost1.createdAt) {
            throw new Error('createdAt timestamp is missing from the response.');
        }
        console.log('✅ Test Case 1 Passed: Kids posts list successfully returned creator firstName, lastName, username, and createdAt.');

        console.log('Test Case 2: Testing queryAdminGeneralPosts...');
        const req2 = {
            query: { page: '1', limit: '10', status: 'approved' },
            admin: admin,
        };
        const res2 = await runController(adminPostController.queryAdminGeneralPosts, req2);

        if (res2.statusCode !== 200) {
            throw new Error(`queryAdminGeneralPosts failed with status code ${res2.statusCode}`);
        }

        const posts2 = res2.data.data.results;
        const testPost2 = posts2.find(p => p._id.toString() === post2Id.toString());
        if (!testPost2) {
            throw new Error('General post not found in queryAdminGeneralPosts results.');
        }

        console.log('Checking Creator Details on General Post:', testPost2.creator);
        if (!testPost2.creator || typeof testPost2.creator !== 'object') {
            throw new Error('Creator field was not populated to an object.');
        }
        if (testPost2.creator.firstName !== 'Reporting' || testPost2.creator.lastName !== 'User' || testPost2.creator.username !== 'repuser') {
            throw new Error('Creator details on queryAdminGeneralPosts did not match test user values!');
        }
        if (!testPost2.createdAt) {
            throw new Error('createdAt timestamp is missing from the response.');
        }
        console.log('✅ Test Case 2 Passed: General posts list successfully returned creator firstName, lastName, username, and createdAt.');

        console.log('Test Case 3: Testing getAdminPost (Single post detail view)...');
        const req3 = {
            params: { postId: post1Id.toString() },
            admin: admin,
        };
        const res3 = await runController(adminPostController.getAdminPost, req3);

        if (res3.statusCode !== 200) {
            throw new Error(`getAdminPost failed with status code ${res3.statusCode}`);
        }

        const postDetail = res3.data.data;
        console.log('Checking Creator Details on Single Post Detail:', postDetail.creator);
        if (!postDetail.creator || typeof postDetail.creator !== 'object') {
            throw new Error('Creator field in getAdminPost was not populated to an object.');
        }
        if (postDetail.creator.firstName !== 'Reporting' || postDetail.creator.lastName !== 'User' || postDetail.creator.username !== 'repuser') {
            throw new Error('Creator details on getAdminPost did not match test user values!');
        }
        if (!postDetail.createdAt) {
            throw new Error('createdAt timestamp is missing from the detail response.');
        }
        console.log('✅ Test Case 3 Passed: Admin post details successfully returned creator firstName, lastName, username, and createdAt.');

        console.log('🎉 ALL ADMIN CREATOR DETAILS & CREATEDAT POPULATION TESTS PASSED SUCCESSFULLY! 🎉');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('Cleaning up remaining test data...');
        if (userId) await User.findByIdAndDelete(userId);
        if (adminId) await Admin.findByIdAndDelete(adminId);
        if (post1Id) await Post.findByIdAndDelete(post1Id);
        if (post2Id) await Post.findByIdAndDelete(post2Id);
        await Category.deleteMany({ name: 'Music' });
        await Language.deleteMany({ name: 'English' });

        console.log('Closing MongoDB connection...');
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

runTest();
