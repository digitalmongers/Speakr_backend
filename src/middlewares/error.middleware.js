const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const Logger = require('../utils/logger');
const env = require('../configs/env');

const errorConverter = (err, req, res, next) => {
    let error = err;
    if (!(error instanceof AppError)) {
        const statusCode =
            error.statusCode || error instanceof mongoose.Error ? 400 : 500;
        const message = error.message || 'Internal Server Error';
        error = new AppError(statusCode, message, false, err.stack);
    }
    next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    let { statusCode, message } = err;
    if (env.NODE_ENV === 'production' && !err.isOperational) {
        statusCode = 500;
        message = 'Internal Server Error';
    }

    res.locals.errorMessage = err.message;

    const response = {
        code: statusCode,
        message,
        ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    };

    // Always log the error internally for monitoring and debugging
    Logger.error(err.message, { error: err });

    res.status(statusCode).send(response);
};

module.exports = {
    errorConverter,
    errorHandler,
};
