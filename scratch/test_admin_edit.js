require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');
const Admin = require('../src/models/admin/admin.model');
const Category = require('../src/models/category.model');
const Language = require('../src/models/language.model');
const { Post } = require('../src/models/post.model');
const postService = require('../src/services/post.service');
const AppError = require('../src/utils/AppError');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let userId = null;
    let adminId = null;
    let postId = null;

    try {
        console.log('Cleaning up existing test data...');
        await User.deleteMany({ username: 'testuseredit' });
        await Admin.deleteMany({ email: 'testadminedit@speakr.com' });
        await Category.deleteMany({ name: { $in: ['Old Category', 'New Category', 'Inactive Category'] } });
        await Language.deleteMany({ name: { $in: ['Old Language', 'New Language', 'Inactive Language'] } });

        console.log('Creating test categories and languages...');
        await Category.create([
            { name: 'Old Category', isActive: true },
            { name: 'New Category', isActive: true },
            { name: 'Inactive Category', isActive: false },
        ]);
        await Language.create([
            { name: 'Old Language', isActive: true },
            { name: 'New Language', isActive: true },
            { name: 'Inactive Language', isActive: false },
        ]);

        console.log('Creating test user...');
        const user = await User.create({
            firstName: 'Test',
            lastName: 'User',
            username: 'testuseredit',
            email: 'testuseredit@speakr.com',
            password: 'Password123!',
            dob: new Date('1990-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
        });
        userId = user._id;

        console.log('Creating test admin...');
        const admin = await Admin.create({
            name: 'Test Admin',
            email: 'testadminedit@speakr.com',
            password: 'Password123!',
            role: 'superadmin',
        });
        adminId = admin._id;

        console.log('Creating test post...');
        const post = await Post.create({
            title: 'Original Title',
            description: 'This is the original description.',
            audioUrl: 'https://speakr.com/dummy.mp3',
            audioKey: 'dummy_audio_key_edit',
            thumbnailUrl: 'https://speakr.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_edit',
            category: 'Old Category',
            language: 'Old Language',
            isKidsContent: false,
            creator: userId,
            creatorUsername: user.username,
        });
        postId = post._id;

        console.log('Test Case 1: Successful Update by Admin...');
        const updatedPost = await postService.updatePostByAdmin(postId, {
            title: 'Updated Title',
            category: 'New Category',
            language: 'New Language',
        }, adminId);

        if (updatedPost.title !== 'Updated Title' || updatedPost.category !== 'New Category' || updatedPost.language !== 'New Language') {
            throw new Error(`Test Case 1 Failed: Fields not updated correctly. Got ${JSON.stringify(updatedPost)}`);
        }
        console.log('✅ Test Case 1 Passed: Fields updated successfully in DB.');

        console.log('Test Case 2: Validation Failure - Inactive Category...');
        try {
            await postService.updatePostByAdmin(postId, { category: 'Inactive Category' }, adminId);
            throw new Error('Test Case 2 Failed: Did not throw validation error for inactive category!');
        } catch (error) {
            if (error instanceof AppError && error.statusCode === 400 && error.message.includes('either inactive or does not exist')) {
                console.log('✅ Test Case 2 Passed: Correctly blocked updating to inactive category.');
            } else {
                throw error;
            }
        }

        console.log('Test Case 3: Validation Failure - Non-existent Language...');
        try {
            await postService.updatePostByAdmin(postId, { language: 'Ghost Language' }, adminId);
            throw new Error('Test Case 3 Failed: Did not throw validation error for ghost language!');
        } catch (error) {
            if (error instanceof AppError && error.statusCode === 400 && error.message.includes('either inactive or does not exist')) {
                console.log('✅ Test Case 3 Passed: Correctly blocked updating to non-existent language.');
            } else {
                throw error;
            }
        }

        console.log('Test Case 4: Validation Failure - Post Not Found...');
        const fakePostId = new mongoose.Types.ObjectId();
        try {
            await postService.updatePostByAdmin(fakePostId, { title: 'No Post' }, adminId);
            throw new Error('Test Case 4 Failed: Did not throw 404 error for non-existent post!');
        } catch (error) {
            if (error instanceof AppError && error.statusCode === 404) {
                console.log('✅ Test Case 4 Passed: Correctly returned 404 post not found.');
            } else {
                throw error;
            }
        }

        console.log('🎉 ALL ADMIN POST UPDATE TESTS PASSED SUCCESSFULLY! 🎉');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('Cleaning up remaining test data...');
        if (userId) await User.findByIdAndDelete(userId);
        if (adminId) await Admin.findByIdAndDelete(adminId);
        if (postId) await Post.findByIdAndDelete(postId);
        await Category.deleteMany({ name: { $in: ['OldCategory', 'NewCategory', 'InactiveCategory'] } });
        await Language.deleteMany({ name: { $in: ['OldLanguage', 'NewLanguage', 'InactiveLanguage'] } });

        console.log('Closing MongoDB connection...');
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

runTest();
