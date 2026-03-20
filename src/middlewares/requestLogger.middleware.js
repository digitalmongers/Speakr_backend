const Logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
    const start = Date.now();


    Logger.logRequest(req);


    const originalSend = res.send;
    res.send = function (body) {
        res.locals.responseBody = body;
        return originalSend.call(this, body);
    };


    res.on('finish', () => {
        const duration = Date.now() - start;

        let responseBody = res.locals.responseBody;
        try {
            if (typeof responseBody === 'string') {
                responseBody = JSON.parse(responseBody);
            }
        } catch (e) {

        }

        Logger.logResponse(req, res, duration, responseBody);
    });

    next();
};

module.exports = requestLogger;
