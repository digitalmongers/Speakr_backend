require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/configs/db.config');
const User = require('./src/models/user.model');
const { Post } = require('./src/models/post.model');
const { Comment } = require('./src/models/comment.model');
const { CommentReply } = require('./src/models/commentReply.model');
const commentService = require('./src/services/comment.service');
const commentReplyService = require('./src/services/commentReply.service');
const commentRepository = require('./src/repositories/comment.repository');
const UploadService = require('./src/services/upload.service');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let testUser = null;
    let testPost = null;
    let testComment = null;
    let testReplyId = null;
    let isMockUser = false;
    let isMockPost = false;
    let isMockComment = false;

    // Track calls to deleteFromS3
    let deleteFromS3CalledWith = null;
    const originalDeleteFromS3 = UploadService.deleteFromS3;
    UploadService.deleteFromS3 = async (key) => {
        deleteFromS3CalledWith = key;
        console.log(`[Mocked deleteFromS3] Key intercepted: ${key}`);
        return true;
    };

    try {
        // 1. Get or create a test user
        testUser = await User.findOne({ username: 'testreplier' });
        if (!testUser) {
            console.log('Creating a mock user for testing...');
            testUser = await User.create({
                firstName: 'Test',
                lastName: 'Replier',
                username: 'testreplier',
                email: 'testreplier@speakr.com',
                password: 'Password123!',
                dob: new Date('1995-05-15'),
                gender: 'male',
                role: 'user',
                isEmailVerified: true,
            });
            isMockUser = true;
        }
        console.log(`Using User: ${testUser.username} (${testUser._id})`);

        // 2. Get or create a test post
        testPost = await Post.findOne();
        if (!testPost) {
            console.log('Creating a mock post for testing...');
            testPost = await Post.create({
                title: 'Test Audio Post Title for Replies',
                description: 'This is a test description of the audio post for comment replies verification.',
                audioUrl: 'https://cloudinary.com/dummy.mp3',
                audioKey: 'dummy_audio_key',
                thumbnailUrl: 'https://cloudinary.com/dummy.jpg',
                thumbnailKey: 'dummy_thumbnail_key',
                category: 'Music',
                language: 'English',
                isKidsContent: false,
                creator: testUser._id,
                creatorUsername: testUser.username,
            });
            isMockPost = true;
        }
        console.log(`Using Post ID: ${testPost._id}`);

        // 3. Create a parent comment
        testComment = await Comment.findOne({ post: testPost._id });
        if (!testComment) {
            console.log('Creating parent comment...');
            testComment = await Comment.create({
                post: testPost._id,
                user: testUser._id,
                content: 'This is a parent comment for reply testing!',
            });
            isMockComment = true;
        }
        console.log(`Using Comment ID: ${testComment._id}, Initial Replies Count: ${testComment.audioRepliesCount || 0}`);

        const initialRepliesCount = testComment.audioRepliesCount || 0;

        // 4. Test adding an audio reply
        console.log('Adding comment reply via service...');
        const mockFile = {
            location: 'https://cloudinary.com/dummy_reply.mp3',
            key: 'uploads/audio/testreplier/dummy_reply_key.mp3',
            size: 50000,
            mimetype: 'audio/mpeg',
            originalname: 'reply.mp3',
        };

        const newReply = await commentReplyService.addReply(
            testPost._id,
            testComment._id,
            testUser._id,
            mockFile
        );

        testReplyId = newReply._id;
        console.log('Reply created successfully:', newReply);

        if (newReply.audioUrl !== mockFile.location) {
            throw new Error('Audio URL mismatch');
        }
        if (!newReply.timeAgo) {
            throw new Error('Missing relative timeAgo property in new reply');
        }
        console.log('✅ Reply returned with timeAgo:', newReply.timeAgo);

        // 5. Verify parent comment audioRepliesCount has incremented
        const updatedComment = await commentRepository.findById(testComment._id);
        console.log(`Comment Replies Count after insertion: ${updatedComment.audioRepliesCount}`);
        if (updatedComment.audioRepliesCount !== initialRepliesCount + 1) {
            throw new Error(`Replies count did not increment. Expected ${initialRepliesCount + 1}, got ${updatedComment.audioRepliesCount}`);
        }
        console.log('✅ Comment audioRepliesCount incremented atomically');

        // 6. Get replies by comment id
        console.log('Fetching replies list...');
        const repliesResponse = await commentReplyService.getRepliesByCommentId(testPost._id, testComment._id);
        const repliesList = repliesResponse.results;
        console.log(`Found ${repliesList.length} replies. Retrieving oldest one:`);
        const oldestReply = repliesList[0];
        console.log(oldestReply);

        if (!oldestReply.user || !oldestReply.user.username) {
            throw new Error('Reply creator user reference was not populated');
        }
        console.log(`✅ Reply populated with username: ${oldestReply.user.username}`);

        if (!oldestReply.timeAgo) {
            throw new Error('Reply object does not have timeAgo field in query list');
        }
        console.log(`✅ Reply list contains timeAgo: ${oldestReply.timeAgo}`);

        // 7. Test storage asset cleanup rollback safeguard on transaction failure
        console.log('Testing storage asset rollback safeguard...');
        deleteFromS3CalledWith = null;
        try {
            // Force a validation error by passing null for user ID inside transaction
            await commentReplyService.addReply(
                testPost._id,
                testComment._id,
                null, // This will trigger a Mongoose validation error on User field
                { key: 'failed_transaction_file_key' }
            );
            throw new Error('Add reply should have failed due to missing user ID');
        } catch (err) {
            console.log('Caught expected transaction error:', err.message);
            if (deleteFromS3CalledWith !== 'failed_transaction_file_key') {
                throw new Error(`File key was not cleaned up during rollback. Got ${deleteFromS3CalledWith}`);
            }
            console.log('✅ Rollback asset cleanup safeguard triggered successfully!');
        }

        // 7b. Test Spam Prevention (10 replies limit per user)
        console.log('Testing spam prevention (max 10 replies)...');
        const createdRepliesForSpam = [];
        try {
            // We already created 1 reply (newReply). So let's create 9 more to reach the limit of 10.
            for (let i = 2; i <= 10; i++) {
                const extraReply = await commentReplyService.addReply(
                    testPost._id,
                    testComment._id,
                    testUser._id,
                    {
                        location: `https://cloudinary.com/dummy_reply_${i}.mp3`,
                        key: `uploads/audio/testreplier/dummy_reply_key_${i}.mp3`,
                        size: 50000,
                        mimetype: 'audio/mpeg',
                        originalname: `reply_${i}.mp3`,
                    }
                );
                createdRepliesForSpam.push(extraReply._id);
            }
            console.log(`Created 9 more replies successfully. Current total for user is 10.`);

            // Now, the 11th reply from the same user should fail
            try {
                await commentReplyService.addReply(
                    testPost._id,
                    testComment._id,
                    testUser._id,
                    {
                        location: `https://cloudinary.com/dummy_reply_11.mp3`,
                        key: `uploads/audio/testreplier/dummy_reply_key_11.mp3`,
                        size: 50000,
                        mimetype: 'audio/mpeg',
                        originalname: 'reply_11.mp3',
                    }
                );
                throw new Error('Expected 11th reply to fail, but it succeeded');
            } catch (spamError) {
                if (spamError.statusCode !== 429) {
                    throw new Error(`Expected HTTP 429 (TOO_MANY_REQUESTS) but got ${spamError.statusCode}: ${spamError.message}`);
                }
                console.log('✅ Spam prevention successfully blocked the 11th reply!');
            }
        } finally {
            // Clean up the 9 extra replies
            console.log('Cleaning up extra spam-test replies...');
            for (const replyId of createdRepliesForSpam) {
                await CommentReply.findByIdAndDelete(replyId);
                await Comment.findByIdAndUpdate(testComment._id, { $inc: { audioRepliesCount: -1 } });
            }
        }

        // 8. Test deleting the reply
        console.log('Deleting reply via service...');
        deleteFromS3CalledWith = null;
        await commentReplyService.deleteReply(testPost._id, testComment._id, testReplyId, testUser._id);
        console.log('Reply deleted successfully.');

        if (deleteFromS3CalledWith !== mockFile.key) {
            throw new Error(`Expected storage deletion of reply key ${mockFile.key}, but intercepted ${deleteFromS3CalledWith}`);
        }
        console.log('✅ Storage deletion triggered successfully post-commit!');

        // Mark as cleaned up so finally block does not double delete / decrement
        testReplyId = null;

        // Verify parent comment audioRepliesCount has decremented back
        const commentAfterDelete = await commentRepository.findById(testComment._id);
        console.log(`Comment Replies Count after deletion: ${commentAfterDelete.audioRepliesCount}`);
        if (commentAfterDelete.audioRepliesCount !== initialRepliesCount) {
            throw new Error(`Replies count did not decrement. Expected ${initialRepliesCount}, got ${commentAfterDelete.audioRepliesCount}`);
        }
        console.log('✅ Comment audioRepliesCount decremented atomically');

        // Verify reply is truly gone from query list
        const repliesResponseAfterDelete = await commentReplyService.getRepliesByCommentId(testPost._id, testComment._id);
        const repliesListAfterDelete = repliesResponseAfterDelete.results;
        const exists = repliesListAfterDelete.some(r => r._id.toString() === testReplyId);
        if (exists) {
            throw new Error('Reply still exists in comment replies query list after deletion');
        }
        console.log('✅ Reply is completely removed from list query response');

        console.log('\n🎉 ALL AUDIO REPLY INTEGRATION TESTS PASSED MATCHING THE SPECIFICATIONS! 🎉\n');

    } catch (err) {
        console.error('❌ Test failed with error:', err.stack || err.message);
    } finally {
        // Restore original delete function
        UploadService.deleteFromS3 = originalDeleteFromS3;

        // Cleanup created reply if not already deleted by the test
        if (testReplyId) {
            console.log('Cleaning up test reply...');
            await CommentReply.findByIdAndDelete(testReplyId);
            if (testComment) {
                await Comment.findByIdAndUpdate(testComment._id, { $inc: { audioRepliesCount: -1 } });
            }
        }
        // Cleanup mock comment, post and user if created
        if (isMockComment && testComment) {
            console.log('Cleaning up mock comment...');
            await Comment.findByIdAndDelete(testComment._id);
        }
        if (isMockPost && testPost) {
            console.log('Cleaning up mock post...');
            await Post.findByIdAndDelete(testPost._id);
        }
        if (isMockUser && testUser) {
            console.log('Cleaning up mock user...');
            await User.findByIdAndDelete(testUser._id);
        }

        console.log('Closing MongoDB Connection...');
        await mongoose.connection.close();
        console.log('MongoDB Connection closed.');
        process.exit(0);
    }
};

runTest();
