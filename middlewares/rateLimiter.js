/**
 * Lightweight, in-memory Rate Limiting middleware for Express.
 * Prevents DDoS and brute-force attacks by limiting requests per IP address.
 */
const rateLimit = (options = {}) => {
    const windowMs = options.windowMs || 15 * 60 * 1000; // default 15 minutes
    const max = options.max || 150; // default 150 requests per windowMs
    const message = options.message || 'Too many requests, please try again later.';
    
    const hits = new Map();
    
    // Clean up expired entries every minute to prevent memory leakage
    setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of hits.entries()) {
            if (now > data.resetTime) {
                hits.delete(ip);
            }
        }
    }, 60000);

    return (req, res, next) => {
        const ip = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
        const now = Date.now();
        
        if (!hits.has(ip)) {
            hits.set(ip, {
                count: 1,
                resetTime: now + windowMs
            });
            return next();
        }
        
        const data = hits.get(ip);
        if (now > data.resetTime) {
            data.count = 1;
            data.resetTime = now + windowMs;
            return next();
        }
        
        data.count++;
        if (data.count > max) {
            console.warn(`⚠️ Rate limit exceeded for client IP: ${ip} on route: ${req.originalUrl}`);
            return res.status(429).json({
                success: false,
                error: message
            });
        }
        
        next();
    };
};

module.exports = rateLimit;
