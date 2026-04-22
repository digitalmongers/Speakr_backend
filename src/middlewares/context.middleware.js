const RequestContext = require('../utils/context');
const { v4: uuidv4 } = require('uuid');

const contextMiddleware = (req, res, next) => {
    const requestId = req.requestId || req.id || uuidv4();
    
    const context = {
        requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
    };

    RequestContext.run(context, () => {
        next();
    });
};

module.exports = contextMiddleware;
