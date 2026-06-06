require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');
const { Post } = require('../src/models/post.model');
const { Comment } = require('../src/models/comment.model');
const { CommentReply } = require('../src/models/commentReply.model');
const { Like } = require('../src/models/like.model');
const { Dislike } = require('../src/models/dislike.model');
const { SavedPost } = require('../src/models/savedPost.model');
const { Listen } = require('../src/models/listen.model');
const adminUserService = require('../src/services/admin/adminUser.service');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let userAId = null;
    let userBId = null;
    let post1Id = null;
    let post2Id = null;
    let comment1Id = null;
    let comment2Id = null;

    try {
        console.log('Cleaning up existing test data...');
        await User.deleteMany({ username: { $in: ['useradeleted', 'userbnormal'] } });

        console.log('Creating test users...');
        const userA = await User.create({
            firstName: 'UserA',
            lastName: 'Deleted',
            username: 'useradeleted',
            email: 'useradeleted@speakr.com',
            password: 'Password123!',
            dob: new Date('1990-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
        });
        userAId = userA._id;

        const userB = await User.create({
            firstName: 'UserB',
            lastName: 'Normal',
            username: 'userbnormal',
            email: 'userbnormal@speakr.com',
            password: 'Password123!',
            dob: new Date('1991-01-01'),
            gender: 'female',
            role: 'user',
            isEmailVerified: true,
        });
        userBId = userB._id;

        console.log('Creating posts...');
        // Post 1: Created by User A (will be cascade deleted)
        const post1 = await Post.create({
            title: 'Post 1 of User A',
            description: 'This post is created by User A and will be cascade deleted.',
            audioUrl: 'https://cloudinary.com/dummy.mp3',
            audioKey: 'dummy_audio_key_post1',
            thumbnailUrl: 'https://cloudinary.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_post1',
            category: 'Music',
            language: 'English',
            isKidsContent: false,
            creator: userAId,
            creatorUsername: userA.username,
        });
        post1Id = post1._id;

        // Post 2: Created by User B (will stay, but reactions will be decremented)
        const post2 = await Post.create({
            title: 'Post 2 of User B',
            description: 'This post is created by User B and will remain.',
            audioUrl: 'https://cloudinary.com/dummy.mp3',
            audioKey: 'dummy_audio_key_post2',
            thumbnailUrl: 'https://cloudinary.com/dummy.jpg',
            thumbnailKey: 'dummy_thumbnail_key_post2',
            category: 'Podcast',
            language: 'English',
            isKidsContent: false,
            creator: userBId,
            creatorUsername: userB.username,
        });
        post2Id = post2._id;

        console.log('User B comments on User A\'s Post 1 (will be deleted when post is deleted)...');
        const comment1 = await Comment.create({
            post: post1Id,
            user: userBId,
            content: 'User B commented on User A\'s post.',
        });
        comment1Id = comment1._id;
        await Post.findByIdAndUpdate(post1Id, { $inc: { commentsCount: 1 } });

        console.log('User A comments on User B\'s Post 2 (will be deleted when user is deleted)...');
        const comment2 = await Comment.create({
            post: post2Id,
            user: userAId,
            content: 'User A commented on User B\'s post.',
        });
        comment2Id = comment2._id;
        await Post.findByIdAndUpdate(post2Id, { $inc: { commentsCount: 1 } });

        console.log('User A likes User B\'s Post 2 (will be deleted and decrement likesCount)...');
        await Like.create({ post: post2Id, user: userAId });
        await Post.findByIdAndUpdate(post2Id, { $inc: { likesCount: 1 } });

        // Verify initial counts of Post 2
        let p2 = await Post.findById(post2Id);
        console.log(`Initial Post 2 likesCount: ${p2.likesCount}, commentsCount: ${p2.commentsCount}`);
        if (p2.likesCount !== 1 || p2.commentsCount !== 1) {
            throw new Error('Initial counts mismatch for Post 2');
        }

        console.log('Triggering cascade deletion for User A...');
        await adminUserService.deleteUser(userAId);

        console.log('--- Verification assertions ---');

        // 1. User A should be deleted
        const deletedUser = await User.findById(userAId);
        if (deletedUser) throw new Error('User A was not deleted!');
        console.log('✅ User A deleted.');

        // 2. Post 1 (User A\'s post) should be deleted
        const deletedPost1 = await Post.findById(post1Id);
        if (deletedPost1) throw new Error('Post 1 was not deleted!');
        console.log('✅ Post 1 deleted.');

        // 3. Comment 1 on Post 1 should be deleted
        const deletedComment1 = await Comment.findById(comment1Id);
        if (deletedComment1) throw new Error('Comment 1 on Post 1 was not deleted!');
        console.log('✅ Comment 1 deleted.');

        // 4. Comment 2 created by User A on Post 2 should be deleted
        const deletedComment2 = await Comment.findById(comment2Id);
        if (deletedComment2) throw new Error('Comment 2 created by User A was not deleted!');
        console.log('✅ Comment 2 deleted.');

        // 5. Post 2 counts should be decremented back to 0
        p2 = await Post.findById(post2Id);
        console.log(`Final Post 2 likesCount: ${p2.likesCount}, commentsCount: ${p2.commentsCount}`);
        if (p2.likesCount !== 0 || p2.commentsCount !== 0) {
            throw new Error(`Post 2 counts not decremented correctly: likesCount ${p2.likesCount}, commentsCount ${p2.commentsCount}`);
        }
        console.log('✅ Post 2 likes and comments counts correctly decremented.');

        console.log('🎉 ALL CASCADE DELETION TESTS PASSED SUCCESSFULLY! 🎉');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('Cleaning up remaining test data...');
        if (userBId) await User.findByIdAndDelete(userBId);
        if (post2Id) await Post.findByIdAndDelete(post2Id);
        if (comment2Id) await Comment.findByIdAndDelete(comment2Id);
        console.log('Closing MongoDB connection...');
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

runTest();
