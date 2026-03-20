const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const Sentry = require('@sentry/node');
const { sanitize } = require('./safeLogger');
const RequestContext = require('./context');

const { combine, timestamp, errors, printf, colorize, json, metadata } = winston.format;

const devLogFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}] : ${stack || message}`;
    const metaKeys = Object.keys(meta).filter(key => key !== 'service');
    if (metaKeys.length > 0) log += `\n${JSON.stringify(meta, null, 2)}`;
    return log;
});

const flattenMeta = winston.format((info) => {
    if (info.metadata) {
        Object.assign(info, info.metadata);
        delete info.metadata;
    }
    return info;
});

const prodLogFormat = combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
    flattenMeta(),
    json()
);

const developmentFormat = combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    colorize({ all: true }),
    devLogFormat
);

const transports = [
    new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
        // Remove format here to use the logger's format
    })
];

if (process.env.NODE_ENV !== 'production' || process.env.PERSISTENT_LOGS === 'true') {
    transports.push(
        new DailyRotateFile({
            filename: path.join(__dirname, '../../logs/%DATE%-combined.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            // Remove format here
        }),
        new DailyRotateFile({
            filename: path.join(__dirname, '../../logs/%DATE%-error.log'),
            level: 'error',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '10m',
            maxFiles: '30d',
            // Remove format here
        })
    );
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: process.env.NODE_ENV === 'production' ? prodLogFormat : developmentFormat,
    defaultMeta: { service: 'Speakr' },
    transports,
});

class Logger {
    static info(message, meta = {}) {
        logger.info(message, sanitize({ ...RequestContext.getAll(), ...meta }));
    }

    static error(message, meta = {}) {
        const contextMeta = { ...RequestContext.getAll(), ...meta };
        logger.error(message, sanitize(contextMeta));

        // Enterprise: Report to Sentry (uncomment and init Sentry in app.js if DSN provided)
        // if (process.env.SENTRY_DSN) {
        //   if (meta.error instanceof Error) {
        //     Sentry.captureException(meta.error, { extra: sanitize(contextMeta) });
        //   } else {
        //     Sentry.captureMessage(message, { level: 'error', extra: sanitize(contextMeta) });
        //   }
        // }
    }

    static warn(message, meta = {}) {
        logger.warn(message, sanitize({ ...RequestContext.getAll(), ...meta }));
    }

    static debug(message, meta = {}) {
        logger.debug(message, sanitize({ ...RequestContext.getAll(), ...meta }));
    }

    static http(message, meta = {}) {
        logger.http(message, sanitize({ ...RequestContext.getAll(), ...meta }));
    }

    static logRequest(req) {
        logger.http('HTTP Request', {
            requestId: req.requestId || req.id,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            query: sanitize(req.query),
            body: sanitize(req.body),
        });
    }

    static logResponse(req, res, responseTime, responseBody = null) {
        let level = 'http';
        if (res.statusCode >= 500) level = 'error';
        else if (res.statusCode >= 400 && res.statusCode !== 404) level = 'warn';
        else if (res.statusCode === 404) level = 'info';

        logger[level]('HTTP Response', sanitize({
            ...RequestContext.getAll(),
            requestId: req.requestId || req.id,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            responseBody: responseBody,
        }));
    }

    static logError(error, req = null) {
        const errorLog = {
            message: error.message,
            stack: error.stack,
            statusCode: error.statusCode,
            code: error.code,
        };
        if (req) {
            errorLog.request = {
                requestId: req.requestId || req.id,
                method: req.method,
                url: req.url,
            };
        }
        logger.error('Application Error', errorLog);
    }
}

module.exports = Logger;
