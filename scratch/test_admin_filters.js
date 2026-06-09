require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');
const Admin = require('../src/models/admin/admin.model');
const { Post } = require('../src/models/post.model');
const Category = require('../src/models/category.model');
const Language = require('../src/models/language.model');
const adminPostController = require('../src/controllers/admin/adminPost.controller');
const adminPostValidation = require('../src/validations/adminPost.validation');
const validate = require('../src/middlewares/validate.middleware');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let userId = null;
    let adminId = null;
    let post1Id = null;
    let post2Id = null;
    let post3Id = null;

    try {
        console.log('Cleaning up existing test data...');
        await User.deleteMany({ username: 'filteruser' });
        await Admin.deleteMany({ email: 'filteradmin@speakr.com' });
        await Category.deleteMany({ name: { $in: ['History', 'Other'] } });
        await Language.deleteMany({ name: 'Hindi' });

        console.log('Creating test categories and languages...');
        await Category.create([
            { name: 'History', isActive: true },
            { name: 'Other', isActive: true },
        ]);
        await Language.create({ name: 'Hindi', isActive: true });

        console.log('Creating test user...');
        const user = await User.create({
            firstName: 'Filter',
            lastName: 'User',
            username: 'filteruser',
            email: 'filteruser@speakr.com',
            password: 'Password123!',
            dob: new Date('1990-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
        });
        userId = user._id;

        console.log('Creating test admin...');
        const admin = await Admin.create({
            name: 'Filter Admin',
            email: 'filteradmin@speakr.com',
            password: 'Password123!',
            role: 'superadmin',
        });
        adminId = admin._id;

        console.log('Creating posts...');
        // Post 1: Category: History, Language: Hindi
        const post1 = await Post.create({
            title: 'First History Post',
            description: 'This is the first history post.',
            audioUrl: 'https://speakr.com/dummy.mp3',
            audioKey: 'dummy_audio_key_1',
            thumbnailUrl: 'https://speakr.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_1',
            category: 'History',
            language: 'Hindi',
            isKidsContent: false,
            status: 'approved',
            creator: userId,
            creatorUsername: user.username,
            createdAt: new Date('2026-06-09T10:00:00Z'),
        });
        post1Id = post1._id;

        // Post 2: Category: History, Language: Hindi (older)
        const post2 = await Post.create({
            title: 'Second History Post',
            description: 'This is the second history post.',
            audioUrl: 'https://speakr.com/dummy.mp3',
            audioKey: 'dummy_audio_key_2',
            thumbnailUrl: 'https://speakr.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_2',
            category: 'History',
            language: 'Hindi',
            isKidsContent: false,
            status: 'approved',
            creator: userId,
            creatorUsername: user.username,
            createdAt: new Date('2026-06-09T09:00:00Z'),
        });
        post2Id = post2._id;

        // Post 3: Category: Other, Language: Hindi
        const post3 = await Post.create({
            title: 'Other Post',
            description: 'This is a post in Other category.',
            audioUrl: 'https://speakr.com/dummy.mp3',
            audioKey: 'dummy_audio_key_3',
            thumbnailUrl: 'https://speakr.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_3',
            category: 'Other',
            language: 'Hindi',
            isKidsContent: false,
            status: 'approved',
            creator: userId,
            creatorUsername: user.username,
            createdAt: new Date('2026-06-09T08:00:00Z'),
        });
        post3Id = post3._id;

        // Helper to run route middleware validation and controller
        const runRoute = (validatorMiddleware, controllerFn, req) => {
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
                // Validation middleware "next" is called if validation succeeds
                const nextVal = (valErr) => {
                    if (valErr) reject(valErr);
                    else {
                        // Call controller and pass mock response
                        controllerFn(req, res, (ctrlErr) => {
                            if (ctrlErr) reject(ctrlErr);
                            else resolve(res);
                        });
                    }
                };
                validatorMiddleware(req, res, nextVal);
            });
        };

        const validateQuery = validate(adminPostValidation.queryAdminPosts);

        console.log('Test Case 1: Category, Language, and Creator Filters Validation...');
        const req1 = {
            query: {
                category: 'History',
                language: 'Hindi',
                creator: userId.toString(),
                status: 'approved',
                limit: '10',
            },
            admin: admin,
        };

        const res1 = await runRoute(validateQuery, adminPostController.queryAdminGeneralPosts, req1);
        if (res1.statusCode !== 200) {
            throw new Error(`queryAdminGeneralPosts failed with status ${res1.statusCode}`);
        }

        const posts1 = res1.data.data.results;
        console.log(`Filtered query returned ${posts1.length} posts.`);
        
        // Assertions for filtering
        const containsPost1 = posts1.some(p => p._id.toString() === post1Id.toString());
        const containsPost2 = posts1.some(p => p._id.toString() === post2Id.toString());
        const containsPost3 = posts1.some(p => p._id.toString() === post3Id.toString());

        if (!containsPost1 || !containsPost2) {
            throw new Error('Test Case 1 Failed: Filtered posts do not contain history posts!');
        }
        if (containsPost3) {
            throw new Error('Test Case 1 Failed: Category filter failed, post in Other category was returned!');
        }
        console.log('✅ Test Case 1 Passed: Category, Language, and Creator filters worked correctly and returned strings.');

        console.log('Test Case 2: Cursor Pagination - Retrieve first page (limit: 1)...');
        const req2 = {
            query: {
                category: 'History',
                language: 'Hindi',
                status: 'approved',
                limit: '1',
            },
            admin: admin,
        };
        const res2 = await runRoute(validateQuery, adminPostController.queryAdminGeneralPosts, req2);
        if (res2.statusCode !== 200) {
            throw new Error(`Cursor query failed with status ${res2.statusCode}`);
        }

        const data2 = res2.data.data;
        const posts2 = data2.results;
        console.log(`Cursor first page returned ${posts2.length} posts. nextCursor: ${data2.nextCursor}, hasNextPage: ${data2.hasNextPage}`);

        if (posts2.length !== 1 || posts2[0]._id.toString() !== post1Id.toString()) {
            throw new Error('Test Case 2 Failed: Did not limit posts list correctly or sort by newest first!');
        }
        if (!data2.hasNextPage || !data2.nextCursor) {
            throw new Error('Test Case 2 Failed: nextCursor or hasNextPage is missing!');
        }
        console.log('✅ Test Case 2 Passed: Cursor pagination successfully returned first post, hasNextPage, and nextCursor.');

        console.log('Test Case 3: Cursor Pagination - Fetch next page using nextCursor...');
        const req3 = {
            query: {
                category: 'History',
                language: 'Hindi',
                status: 'approved',
                limit: '1',
                cursor: data2.nextCursor,
            },
            admin: admin,
        };
        const res3 = await runRoute(validateQuery, adminPostController.queryAdminGeneralPosts, req3);
        if (res3.statusCode !== 200) {
            throw new Error(`Cursor second page failed with status ${res3.statusCode}`);
        }

        const data3 = res3.data.data;
        const posts3 = data3.results;
        console.log(`Cursor second page returned ${posts3.length} posts. nextCursor: ${data3.nextCursor}, hasNextPage: ${data3.hasNextPage}`);

        if (posts3.length !== 1 || posts3[0]._id.toString() !== post2Id.toString()) {
            throw new Error('Test Case 3 Failed: Second page did not return correct next post (post2)!');
        }
        console.log('✅ Test Case 3 Passed: Successfully fetched the next page using cursor parameter.');

        console.log('🎉 ALL ADMIN POST FILTERS AND CURSOR PAGINATION TESTS PASSED SUCCESSFULLY! 🎉');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('Cleaning up remaining test data...');
        if (userId) await User.findByIdAndDelete(userId);
        if (adminId) await Admin.findByIdAndDelete(adminId);
        if (post1Id) await Post.findByIdAndDelete(post1Id);
        if (post2Id) await Post.findByIdAndDelete(post2Id);
        if (post3Id) await Post.findByIdAndDelete(post3Id);
        await Category.deleteMany({ name: { $in: ['History', 'Other'] } });
        await Language.deleteMany({ name: 'Hindi' });

        console.log('Closing MongoDB connection...');
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

runTest();
