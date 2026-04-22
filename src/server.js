require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./configs/db.config');
const Logger = require('./utils/logger');
const env = require('./configs/env');
const { initEmailWorker } = require('./workers/email.worker');
const { closeRedis } = require('./configs/redis');

const port = env.PORT;
let server;

// Connect to MongoDB
connectDB().then(() => {
    // Initialize Email Worker
    initEmailWorker();

    server = app.listen(port, () => {
        Logger.info(`Server is running on port ${port}`);
    });
});

const exitHandler = () => {
    if (server) {
        server.close(async () => {
            Logger.info('Server closed');
            try {
                await mongoose.connection.close();
                Logger.info('MongoDB connection closed.');
                await closeRedis();
                Logger.info('Redis connection closed.');
                process.exit(1);
            } catch (err) {
                Logger.error('Error closing MongoDB connection', { error: err });
                process.exit(1);
            }
        });
    } else {
        process.exit(1);
    }
};

const unexpectedErrorHandler = (error) => {
    Logger.error('Unhandled Rejection or Uncaught Exception:', { error });
    exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
    Logger.info('SIGTERM received. Performing graceful shutdown...');
    if (server) {
        server.close(async () => {
            Logger.info('HTTP server closed.');
            try {
                await mongoose.connection.close();
                Logger.info('MongoDB connection closed.');
                await closeRedis();
                Logger.info('Redis connection closed.');
                process.exit(0);
            } catch (err) {
                Logger.error('Error closing MongoDB connection', { error: err });
                process.exit(1);
            }
        });
    }
});

process.on('SIGINT', () => {
    Logger.info('SIGINT received. Performing graceful shutdown...');
    if (server) {
        server.close(async () => {
            Logger.info('HTTP server closed.');
            try {
                await mongoose.connection.close();
                Logger.info('MongoDB connection closed.');
                await closeRedis();
                Logger.info('Redis connection closed.');
                process.exit(0);
            } catch (err) {
                Logger.error('Error closing MongoDB connection', { error: err });
                process.exit(1);
            }
        });
    } else {
        process.exit(0);
    }
});
