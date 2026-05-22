const httpStatus = require('http-status').default;
const catchAsync = require('../utils/catchAsync');
const listenService = require('../services/listen.service');

/**
 * Controller to record a unique listen on an audio post
 */
const recordListen = catchAsync(async (req, res) => {
    const { postId } = req.params;
    const userId = req.user ? req.user._id : null;
    const guestId = req.body.guestId || req.query.guestId || null;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const result = await listenService.recordListen(postId, { userId, guestId, ipAddress });

    res.status(httpStatus.OK).json({
        status: 'success',
        message: result.newlyListened ? 'Post listen recorded successfully' : 'Post listen already recorded',
        data: result,
    });
});

module.exports = {
    recordListen,
};
