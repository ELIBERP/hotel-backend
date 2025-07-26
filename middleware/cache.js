import NodeCache from 'node-cache';

// Create cache instance with default TTL of 10 minutes (600 seconds)
const cache = new NodeCache({ 
    stdTTL: 600,
    checkperiod: 120 // Check for expired keys every 2 minutes
});

// Cache middleware
const cacheMiddleware = (duration = 600) => {
    return (req, res, next) => {
        // Create cache key from request URL and query parameters
        const key = req.originalUrl || req.url;
        
        // Check if data exists in cache
        const cachedData = cache.get(key);
        
        if (cachedData) {
            const ttl = cache.getTtl(key);
            const timeLeft = ttl ? Math.round((ttl - Date.now()) / 1000) : 0;
            console.log(`🟢 Cache HIT for ${key} (${timeLeft}s remaining)`);
            return res.status(200).json(cachedData);
        }
        
        // If not in cache, store original res.json function
        console.log(`🔴 Cache MISS for ${key}`);
        const originalJson = res.json;
        
        // Override res.json to cache the response
        res.json = function(data) {
            // Cache the response data
            cache.set(key, data, duration);
            console.log(`💾 Data cached for ${key} (TTL: ${duration}s)`);
            
            // Call original json function
            originalJson.call(this, data);
        };
        
        next();
    };
};

// Function to clear cache for specific pattern
const clearCache = (pattern) => {
    const keys = cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    matchingKeys.forEach(key => cache.del(key));
    console.log(`Cleared ${matchingKeys.length} cache entries matching: ${pattern}`);
};

// Function to clear all cache
const clearAllCache = () => {
    cache.flushAll();
    console.log('All cache cleared');
};

export { 
    cacheMiddleware, 
    clearCache, 
    clearAllCache,
    cache 
};