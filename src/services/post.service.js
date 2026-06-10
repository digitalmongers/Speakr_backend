const postRepository = require("../repositories/post.repository");
const userRepository = require("../repositories/user.repository");
const likeRepository = require("../repositories/like.repository");
const categoryRepository = require("../repositories/category.repository");
const languageRepository = require("../repositories/language.repository");
const dislikeRepository = require("../repositories/dislike.repository");
const savedPostRepository = require("../repositories/savedPost.repository");
const listenRepository = require("../repositories/listen.repository");
const commentRepository = require("../repositories/comment.repository");
const commentReplyRepository = require("../repositories/commentReply.repository");
const postReportRepository = require("../repositories/postReport.repository");
const mongoose = require("mongoose");
const UploadService = require("./upload.service");
const AppError = require("../utils/AppError");
const Logger = require("../utils/logger");
const httpStatus = require("http-status").default;
const { runTransaction } = require("../utils/transaction");

/**
 * Create a new audio post
 * @param {ObjectId} userId - Creator ID
 * @param {Object} postData - Post metadata and file details
 * @returns {Promise<Object>}
 */
const createPost = async (userId, postData) => {
  const [user, category, language] = await Promise.all([
    userRepository.getUserById(userId),
    categoryRepository.findByName(postData.category),
    languageRepository.findByName(postData.language),
  ]);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "Creator user not found");
  }

  // Verify category exists and is active
  if (!category || !category.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Category '${postData.category}' is either inactive or does not exist`,
    );
  }
  postData.category = category.name; // Standardize casing to match database record

  // Verify language exists and is active
  if (!language || !language.isActive) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Language '${postData.language}' is either inactive or does not exist`,
    );
  }
  postData.language = language.name; // Standardize casing to match database record

  const postBody = {
    ...postData,
    creator: userId,
    creatorUsername: user.username,
    status: postData.isKidsContent ? 'pending' : 'approved',
  };
  const post = await postRepository.create(postBody);
  Logger.info("Post created successfully", {
    postId: post._id,
    creator: userId,
  });
  return post;
};

/**
 * Retrieve a post by ID
 * @param {ObjectId} postId
 * @param {ObjectId} [userId]
 * @returns {Promise<Object>}
 */
const getPostById = async (postId, userId = null, allowPending = false) => {
  const post = await postRepository.findById(postId);
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  if (post.status !== 'approved' && !allowPending) {
    if (!userId || post.creator.toString() !== userId.toString()) {
      throw new AppError(httpStatus.NOT_FOUND, "Post not found");
    }
  }

  if (userId) {
    const [isLiked, isDisliked, isSaved, isListened] = await Promise.all([
      likeRepository.exists(postId, userId),
      dislikeRepository.exists(postId, userId),
      savedPostRepository.exists(postId, userId),
      listenRepository.existsByUser(postId, userId),
    ]);
    post.isLiked = isLiked;
    post.isDisliked = isDisliked;
    post.isSaved = isSaved;
    post.isListened = isListened;
  } else {
    post.isLiked = false;
    post.isDisliked = false;
    post.isSaved = false;
    post.isListened = false;
  }
  return post;
};

/**
 * Paginated query for public posts (Supports both cursor-based infinite scroll and offset-based paging)
 * @param {Object} filter - Database query filters
 * @param {Object} paginationOptions
 * @param {number} [paginationOptions.page]
 * @param {number} paginationOptions.limit
 * @param {string} [paginationOptions.cursor]
 * @param {ObjectId} [userId] - Optional authenticated user ID for reaction status hydration
 * @returns {Promise<Object>}
 */
const queryPosts = async (
  filter,
  { page, limit = 10, cursor },
  userId = null,
) => {
  // Helper function to hydrate a list of posts in bulk (N+1 query optimization)
  const hydratePosts = async (postsList) => {
    if (!postsList || postsList.length === 0) return postsList;

    if (!userId) {
      postsList.forEach((post) => {
        post.isLiked = false;
        post.isDisliked = false;
        post.isSaved = false;
        post.isListened = false;
      });
      return postsList;
    }

    const postIds = postsList.map((post) => post._id);
    const [likes, dislikes, saves, listens] = await Promise.all([
      likeRepository.findByUserAndPostIds(postIds, userId),
      dislikeRepository.findByUserAndPostIds(postIds, userId),
      savedPostRepository.findByUserAndPostIds(postIds, userId),
      listenRepository.findByUserAndPostIds(postIds, userId),
    ]);

    const likedPostIdsSet = new Set(likes.map((l) => l.post.toString()));
    const dislikedPostIdsSet = new Set(dislikes.map((d) => d.post.toString()));
    const savedPostIdsSet = new Set(saves.map((s) => s.post.toString()));
    const listenedPostIdsSet = new Set(listens.map((li) => li.post.toString()));

    postsList.forEach((post) => {
      const postIdStr = post._id.toString();
      post.isLiked = likedPostIdsSet.has(postIdStr);
      post.isDisliked = dislikedPostIdsSet.has(postIdStr);
      post.isSaved = savedPostIdsSet.has(postIdStr);
      post.isListened = listenedPostIdsSet.has(postIdStr);
    });

    return postsList;
  };

  // If cursor is provided or page is not provided, use Cursor-Based pagination (Infinite Scroll optimized)
  if (cursor !== undefined || !page) {
    const posts = await postRepository.findWithCursor(filter, {
      limit,
      cursor,
    });

    let hasNextPage = false;
    let nextCursor = null;

    if (posts.length > limit) {
      hasNextPage = true;
      const nextItem = posts[limit - 1]; // Get the last item of the requested limit
      nextCursor = nextItem.createdAt.toISOString();
      // Trim the array to the requested limit
      posts.splice(limit);
    }

    await hydratePosts(posts);

    return {
      results: posts,
      limit,
      hasNextPage,
      nextCursor,
    };
  }

  // Fallback to Offset-Based pagination if page is explicitly requested
  const skip = (page - 1) * limit;

  const [posts, totalResults] = await Promise.all([
    postRepository.find(filter, { limit, skip }),
    postRepository.count(filter),
  ]);

  await hydratePosts(posts);

  const totalPages = Math.ceil(totalResults / limit);

  return {
    results: posts,
    page,
    limit,
    totalPages,
    totalResults,
  };
};

/**
 * Delete a post (with associated storage files cleanup)
 * @param {ObjectId} postId
 * @param {ObjectId} userId - Demarcates requester for ownership validation
 * @returns {Promise<boolean>}
 */
const deletePost = async (postId, userId, isAdmin = false) => {
  let postToDelete = null;
  let s3KeysToDelete = [];
  let isDeleted = false;

  try {
    await runTransaction(async (session) => {
      // 1. Verify post exists (session aware)
      const post = await postRepository.findById(postId, session);
      if (!post) {
        throw new AppError(httpStatus.NOT_FOUND, "Post not found");
      }

      // 2. Verify creator ownership (strict RBAC check unless user is admin)
      if (!isAdmin && post.creator.toString() !== userId.toString()) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          "You do not have permission to delete this post",
        );
      }

      postToDelete = post;

      // 3. Find and collect comments associated with this post
      const comments = await commentRepository.findByPostIdRaw(postId, session);
      const commentIds = comments.map((c) => c._id);

      // 4. Find replies to those comments to collect their S3 audioKeys
      if (commentIds.length > 0) {
        const replies = await commentReplyRepository.findManyByCommentIds(
          commentIds,
          session,
        );
        const replyAudioKeys = replies.map((r) => r.audioKey).filter(Boolean);
        s3KeysToDelete.push(...replyAudioKeys);

        // 5. Delete replies from DB
        await commentReplyRepository.deleteManyByCommentIds(
          commentIds,
          session,
        );
      }

      // 6. Delete comments from DB
      await commentRepository.deleteManyByPostId(postId, session);

      // 7. Delete likes, dislikes, saves, and listens
      await likeRepository.deleteManyByPostId(postId, session);
      await dislikeRepository.deleteManyByPostId(postId, session);
      await savedPostRepository.deleteManyByPostId(postId, session);
      await listenRepository.deleteManyByPostId(postId, session);

      // 8. Delete the post record from DB
      const deletedPost = await postRepository.deleteById(postId, session);
      if (deletedPost) {
        isDeleted = true;
      }

      Logger.info(
        "Post and all associated comments, replies, and reactions deleted from DB successfully",
        { postId },
      );
    });

    // 9. After successful transaction commit, clean up S3 assets
    if (isDeleted && postToDelete) {
      // Add post audio and thumbnail keys to deletion queue
      if (postToDelete.audioKey) s3KeysToDelete.push(postToDelete.audioKey);
      if (postToDelete.thumbnailKey)
        s3KeysToDelete.push(postToDelete.thumbnailKey);

      if (s3KeysToDelete.length > 0) {
        Logger.info(
          "Initiating background post and associated comment replies asset cleanup from storage",
          { postId, keysCount: s3KeysToDelete.length },
        );

        // Concurrently delete all collected S3 keys in background
        Promise.all(
          s3KeysToDelete.map((key) =>
            UploadService.deleteFromS3(key).catch((err) =>
              Logger.error(
                `Failed to delete S3 asset ${key} post-commit:`,
                err,
              ),
            ),
          ),
        )
          .then(() => {
            Logger.info(
              "Post assets purged from storage successfully in background",
              { postId },
            );
          })
          .catch((err) => {
            Logger.error("Failed background S3 post assets cleanup:", err);
          });
      }
    }

    return true;
  } catch (error) {
    Logger.error("Error during post deletion transaction:", {
      postId,
      userId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Update status of an audio post (Admin only)
 * @param {ObjectId} postId
 * @param {string} status - 'approved' | 'rejected'
 * @param {ObjectId} adminId
 * @returns {Promise<Object>}
 */
const updatePostStatus = async (postId, status, adminId) => {
  const post = await postRepository.findById(postId);
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  const updatedPost = await postRepository.updateById(postId, { status });
  if (!updatedPost) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  const AuditService = require("./audit.service");
  await AuditService.record({
    action: status === "approved" ? "ADMIN_APPROVE_POST" : "ADMIN_REJECT_POST",
    entity: "Post",
    entityId: postId,
    userId: adminId,
    metadata: { previousStatus: post.status, newStatus: status },
  });

  Logger.info(`Post status updated to ${status} by admin ${adminId}`, { postId });
  return updatedPost;
};

/**
 * Update a post by admin (title, category, language)
 * @param {ObjectId} postId
 * @param {Object} updateBody
 * @param {ObjectId} adminId
 * @returns {Promise<Object>}
 */
const updatePostByAdmin = async (postId, updateBody, adminId) => {
  const post = await postRepository.findById(postId);
  if (!post) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  const updates = {};

  if (updateBody.title !== undefined) {
    updates.title = updateBody.title;
  }

  if (updateBody.category !== undefined) {
    const category = await categoryRepository.findByName(updateBody.category);
    if (!category || !category.isActive) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Category '${updateBody.category}' is either inactive or does not exist`,
      );
    }
    updates.category = category.name;
  }

  if (updateBody.language !== undefined) {
    const language = await languageRepository.findByName(updateBody.language);
    if (!language || !language.isActive) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Language '${updateBody.language}' is either inactive or does not exist`,
      );
    }
    updates.language = language.name;
  }

  const updatedPost = await postRepository.updateById(postId, updates);
  if (!updatedPost) {
    throw new AppError(httpStatus.NOT_FOUND, "Post not found");
  }

  const AuditService = require("./audit.service");
  await AuditService.record({
    action: "ADMIN_UPDATE_POST",
    entity: "Post",
    entityId: postId,
    userId: adminId,
    metadata: {
      previousData: { title: post.title, category: post.category, language: post.language },
      updatedData: updates
    },
  });

  Logger.info(`Post updated by admin ${adminId}`, { postId });
  return updatedPost;
};

/**
 * Report a post for policy violations
 * @param {ObjectId} postId - Target post
 * @param {ObjectId} reporterId - Authenticated user submitting the report
 * @param {string} reason - One of: 'spam', 'fake content', 'abuse', 'copyright'
 * @returns {Promise<Object>} - The created report document
 */
const reportPost = async (postId, reporterId, reason) => {
  // 1. Verify post exists and is publicly visible (only approved posts can be reported)
  const post = await postRepository.findById(postId);
  if (!post || post.status !== 'approved') {
    throw new AppError(httpStatus.NOT_FOUND, 'Post not found');
  }

  // 2. Application-layer duplicate guard (fast path before hitting the DB unique index)
  //    The compound unique index { post, reporter } is the authoritative backstop —
  //    this check simply provides a clean, descriptive error instead of a raw MongoError.
  const alreadyReported = await postReportRepository.existsByPostAndReporter(postId, reporterId);
  if (alreadyReported) {
    throw new AppError(httpStatus.CONFLICT, 'You have already reported this post');
  }

  // 3. Persist the report
  const report = await postReportRepository.create({
    post: postId,
    reporter: reporterId,
    reason,
  });

  Logger.info('Post reported', { postId, reporterId, reason });
  return report;
};

module.exports = {
  createPost,
  getPostById,
  queryPosts,
  deletePost,
  updatePostStatus,
  updatePostByAdmin,
  reportPost,
};
