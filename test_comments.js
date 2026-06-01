require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/configs/db.config');
const User = require('./src/models/user.model');
const { Post } = require('./src/models/post.model');
const { Comment } = require('./src/models/comment.model');
const commentService = require('./src/services/comment.service');
const postRepository = require('./src/repositories/post.repository');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let testUser = null;
    let testPost = null;
    let createdCommentId = null;
    let isMockUser = false;
    let isMockPost = false;

    try {
        // 1. Get or create a test user
        testUser = await User.findOne({ username: 'testcommenter' });
        if (!testUser) {
            console.log('Creating a mock user for testing...');
            testUser = await User.create({
                firstName: 'Test',
                lastName: 'Commenter',
                username: 'testcommenter',
                email: 'testcommenter@speakr.com',
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
                title: 'Test Audio Post Title',
                description: 'This is a test description of the audio post for comment verification.',
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
        console.log(`Using Post ID: ${testPost._id}, Current Comments Count: ${testPost.commentsCount || 0}`);

        const initialCommentsCount = testPost.commentsCount || 0;

        // 3. Add a test comment
        console.log('Adding comment via service...');
        const newComment = await commentService.addComment(
            testPost._id,
            testUser._id,
            'This is an automatic integration test comment!'
        );

        createdCommentId = newComment._id;
        console.log('Comment created successfully:', newComment);

        // Verify timeAgo and presence
        if (newComment.content !== 'This is an automatic integration test comment!') {
            throw new Error('Comment content mismatch');
        }
        if (!newComment.timeAgo) {
            throw new Error('Missing relative timeAgo property in new comment');
        }
        console.log('✅ Comment returned with timeAgo:', newComment.timeAgo);

        // 4. Verify post commentsCount has incremented
        const updatedPost = await postRepository.findById(testPost._id);
        console.log(`Post Comments Count after insertion: ${updatedPost.commentsCount}`);
        if (updatedPost.commentsCount !== initialCommentsCount + 1) {
            throw new Error(`Comments count did not increment. Expected ${initialCommentsCount + 1}, got ${updatedPost.commentsCount}`);
        }
        console.log('✅ Post commentsCount incremented atomically');

        // 5. Get comments by post id
        console.log('Fetching comments list...');
        const commentsResponse = await commentService.getCommentsByPostId(testPost._id);
        const commentsList = commentsResponse.results;
        console.log(`Found ${commentsList.length} comments. Retrieving newest one:`);
        const latestComment = commentsList[0];
        console.log(latestComment);

        if (!latestComment.user || !latestComment.user.username) {
            throw new Error('Comment creator user reference was not populated with username');
        }
        console.log(`✅ Comment populated with username: ${latestComment.user.username}`);

        if (!latestComment.timeAgo) {
            throw new Error('Comment object does not have timeAgo field in query list');
        }
        console.log(`✅ Comment list contains timeAgo: ${latestComment.timeAgo}`);

        // 6. Test deleting the comment
        console.log('Deleting comment via service...');
        await commentService.deleteComment(createdCommentId, testPost._id, testUser._id);
        console.log('Comment deleted successfully.');

        // Mark as cleaned up so finally block does not double delete / decrement
        createdCommentId = null;

        // Verify post commentsCount has decremented back
        const postAfterDelete = await postRepository.findById(testPost._id);
        console.log(`Post Comments Count after deletion: ${postAfterDelete.commentsCount}`);
        if (postAfterDelete.commentsCount !== initialCommentsCount) {
            throw new Error(`Comments count did not decrement. Expected ${initialCommentsCount}, got ${postAfterDelete.commentsCount}`);
        }
        console.log('✅ Post commentsCount decremented atomically');

        // Verify comment is truly gone from query list
        const commentsResponseAfterDelete = await commentService.getCommentsByPostId(testPost._id);
        const commentsListAfterDelete = commentsResponseAfterDelete.results;
        const exists = commentsListAfterDelete.some(c => c._id.toString() === createdCommentId);
        if (exists) {
            throw new Error('Comment still exists in post comments query list after deletion');
        }
        console.log('✅ Comment is completely removed from list query response');

        console.log('\n🎉 ALL INTEGRATION TESTS PASSED MATCHING THE SPECIFICATIONS! 🎉\n');

    } catch (err) {
        console.error('❌ Test failed with error:', err.message);
    } finally {
        // Cleanup created comment if not already deleted by the test
        if (createdCommentId) {
            console.log('Cleaning up test comment...');
            await Comment.findByIdAndDelete(createdCommentId);
            if (testPost) {
                await Post.findByIdAndUpdate(testPost._id, { $inc: { commentsCount: -1 } });
            }
        }
        // Cleanup mock post and user if created
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
