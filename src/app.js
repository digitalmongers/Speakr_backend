const express = require('express');
const { configureSecurity } = require('./middlewares/security.middleware');
const { errorConverter, errorHandler } = require('./middlewares/error.middleware');
const xss = require('xss-clean');
const compression = require('compression');
const routes = require('./routes/v1');
const AppError = require('./utils/AppError');
const Logger = require('./utils/logger');
const requestIdMiddleware = require('./middlewares/requestId.middleware');
const contextMiddleware = require('./middlewares/context.middleware');
const requestLogger = require('./middlewares/requestLogger.middleware');

const app = express();

// Trust proxy for Render/Vercel/Heroku to get real client IP for rate limiting
app.set('trust proxy', 1);

// Set security middlewares
configureSecurity(app);

// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());

// gzip compression
app.use(compression());

// Inject request ID
app.use(requestIdMiddleware);

// Initialize Request Context
app.use(contextMiddleware);

// Advanced enterprise request/response logger
app.use(requestLogger);

// Root route for basic health check and welcome message
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to Speakr API',
        version: '1.0.0'
    });
});

// Dedicated health check for pingers (Render keep-alive)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// v1 api routes
app.use('/api/v1', routes);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
    next(new AppError(404, 'Not found'));
});

// convert error to AppError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
