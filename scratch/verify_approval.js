require('dotenv').config();
const mongoose = require('mongoose');
const postService = require('../src/services/post.service');
const commentService = require('../src/services/comment.service');
const likeService = require('../src/services/like.service');
const savedPostService = require('../src/services/savedPost.service');
const listenService = require('../src/services/listen.service');

const { Post } = require('../src/models/post.model');
const { User } = require('../src/models/user.model');
const { Category } = require('../src/models/category.model');
const { Language } = require('../src/models/language.model');
const Admin = require('../src/models/admin/admin.model');

async function test() {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected.");

    // 1. Create a test user
    console.log("Creating test user, category, language, and admin...");
    const testUser = await User.create({
        fullName: 'Test User',
        username: 'testuser_' + Date.now(),
        email: `testuser_${Date.now()}@example.com`,
        password: 'Password123!',
        isVerified: true,
        gender: 'male',
        role: 'user'
    });

    const testCategory = await Category.create({
        name: 'TestCategory_' + Date.now(),
        isActive: true
    });

    const testLanguage = await Language.create({
        name: 'TestLanguage_' + Date.now(),
        isActive: true
    });

    const testAdmin = await Admin.create({
        fullName: 'Test Admin',
        email: `admin_${Date.now()}@example.com`,
        password: 'AdminPassword123!',
        gender: 'female',
        role: 'superadmin',
        tokenVersion: 1
    });

    // 2. Create kids content post (should default to pending)
    console.log("Creating kids zone post...");
    const postData = {
        title: 'Kids Adventure Audio',
        description: 'An audio file specifically created for kids approval test.',
        audioUrl: 'https://example.com/audio.mp3',
        audioKey: 'audio-key-123',
        thumbnailUrl: 'https://example.com/thumbnail.png',
        thumbnailKey: 'thumbnail-key-123',
        category: testCategory.name,
        language: testLanguage.name,
        isKidsContent: true,
        duration: 120
    };

    const post = await postService.createPost(testUser._id, postData);
    console.log(`Post created. ID: ${post._id}, Status: ${post.status}`);
    if (post.status !== 'pending') {
        throw new Error("Expected post status to be 'pending'");
    }

    // 3. Try to fetch pending post with allowPending = false
    console.log("Attempting to retrieve pending post publicly...");
    try {
        await postService.getPostById(post._id, new mongoose.Types.ObjectId(), false);
        throw new Error("Expected getPostById to fail for guest on pending post");
    } catch (err) {
        console.log("Success: Fetch failed with error: " + err.message);
        if (err.statusCode !== 404) {
            throw new Error("Expected HTTP 404 NOT_FOUND");
        }
    }

    // 4. Try to fetch pending post with allowPending = true
    console.log("Attempting to retrieve pending post as admin (allowPending = true)...");
    const adminFetch = await postService.getPostById(post._id, null, true);
    console.log("Success: Admin retrieved post: " + adminFetch.title);

    // 5. Try to interact (comment, like, listen) on pending post
    console.log("Testing post interactions on pending post...");
    try {
        await commentService.addComment(post._id, testUser._id, "Test comment");
        throw new Error("Expected addComment to fail for pending post");
    } catch (err) {
        console.log("Success: comment failed with: " + err.message);
    }

    try {
        await likeService.toggleLike(post._id, testUser._id);
        throw new Error("Expected toggleLike to fail for pending post");
    } catch (err) {
        console.log("Success: like failed with: " + err.message);
    }

    try {
        await listenService.recordListen(post._id, { userId: testUser._id });
        throw new Error("Expected recordListen to fail for pending post");
    } catch (err) {
        console.log("Success: listen failed with: " + err.message);
    }

    // 6. Approve the post
    console.log("Approving post as admin...");
    const approvedPost = await postService.updatePostStatus(post._id, 'approved', testAdmin._id);
    console.log(`Post updated. ID: ${approvedPost._id}, Status: ${approvedPost.status}`);
    if (approvedPost.status !== 'approved') {
        throw new Error("Expected post status to update to 'approved'");
    }

    // 7. Verify post is now public
    console.log("Attempting public fetch of approved post...");
    const publicFetch = await postService.getPostById(post._id, null, false);
    console.log("Success: Post fetched publicly: " + publicFetch.title);

    // 8. Verify interaction works now
    console.log("Testing post interactions on approved post...");
    const comment = await commentService.addComment(post._id, testUser._id, "Test comment on approved post");
    console.log("Success: Comment added on approved post: " + comment.content);

    const likeResult = await likeService.toggleLike(post._id, testUser._id);
    console.log("Success: Like toggled on approved post. Liked: " + likeResult.liked);

    // Clean up
    console.log("Cleaning up test database records...");
    await Post.findByIdAndDelete(post._id);
    await User.findByIdAndDelete(testUser._id);
    await Category.findByIdAndDelete(testCategory._id);
    await Language.findByIdAndDelete(testLanguage._id);
    await Admin.findByIdAndDelete(testAdmin._id);
    console.log("Clean up finished.");
}

test()
    .then(() => {
        console.log("ALL TESTS PASSED SUCCESSFULLY!");
        process.exit(0);
    })
    .catch(err => {
        console.error("TEST FAILED:", err);
        process.exit(1);
    });
