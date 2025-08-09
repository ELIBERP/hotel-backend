import NodeCache from 'node-cache';

// Create cache instance with default TTL of 10 minutes (600 seconds)
const cache = new NodeCache({ 
    stdTTL: 600,
    checkperiod: 120 // Check for expired keys every 2 minutes
});

// Track pending requests by key for atomic caching
const pendingPromises = {};

// Default timeout for waiting requests (in milliseconds)
const DEFAULT_WAIT_TIMEOUT = 5000; // 5 seconds

// Regular non-atomic cache middleware
const cacheMiddleware = (duration = 600) => {
    return (req, res, next) => {
        // Skip cache if requested (useful for polling endpoints)
        if (req.skipCache === true) {
            return next();
        }
        
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
            // Only cache if we're not skipping cache
            if (req.skipCache !== true) {
                // Cache the response data
                cache.set(key, data, duration);
                console.log(`💾 Data cached for ${key} (TTL: ${duration}s)`);
            }
            
            // Call original json function
            originalJson.call(this, data);
        };
        
        next();
    };
};

// Atomic cache middleware
const atomicCacheMiddleware = (duration = 600, waitTimeout = DEFAULT_WAIT_TIMEOUT) => {
    return async (req, res, next) => {
        // Skip cache if requested (useful for polling endpoints)
        if (req.skipCache === true) {
            return next();
        }
        
        // Get current timestamp for logging
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        // Create cache key from request URL and query parameters
        const key = req.originalUrl || req.url;
        
        // Include user info in logs if available
        const userInfo = req.user ? `(User: ${req.user.login})` : '';

        // Check if data exists in cache
        const cachedData = cache.get(key);
        if (cachedData) {
            const ttl = cache.getTtl(key);
            const timeLeft = ttl ? Math.round((ttl - Date.now()) / 1000) : 0;
            console.log(`${timestamp} 🟢 [ATOMIC] Cache HIT for ${key} (${timeLeft}s remaining) ${userInfo}`);
            return res.status(200).json(cachedData);
        }

        // If we already have a pending request for this key, wait for it
        if (pendingPromises[key]) {
            console.log(`${timestamp} ⏳ [ATOMIC] Waiting for pending request for ${key} ${userInfo}`);
            try {
                // Create a race between the pending promise and a timeout
                const data = await Promise.race([
                    pendingPromises[key],
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Request timeout after ${waitTimeout}ms waiting for ${key}`)), waitTimeout)
                    )
                ]);
                console.log(`${timestamp} ✅ [ATOMIC] Received data from pending request for ${key} ${userInfo}`);
                return res.status(200).json(data);
            } catch (err) {
                console.log(`${timestamp} ❌ [ATOMIC] Error waiting for pending request: ${err.message} ${userInfo}`);
                // If timeout occurred, proceed with a new request instead of waiting
                if (err.message.includes('timeout')) {
                    console.log(`${timestamp} 🔄 [ATOMIC] Timeout occurred, proceeding with new request for ${key} ${userInfo}`);
                    // Continue to the handler (don't return here)
                } else {
                    // For other errors, also continue with a new request
                    console.log(`${timestamp} 🔄 [ATOMIC] Pending request failed, proceeding with new request for ${key} ${userInfo}`);
                }
            }
        }

        console.log(`${timestamp} 🔴 [ATOMIC] Cache MISS for ${key} ${userInfo}`);
        
        // Create a promise for this request
        let resolvePromise, rejectPromise;
        pendingPromises[key] = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        // Store original res.json function
        const originalJson = res.json;
        
        // Override res.json to cache the response and resolve the promise
        res.json = function(data) {
            // Only cache if we're not skipping cache
            if (req.skipCache !== true) {
                // Cache the response data
                cache.set(key, data, duration);
                console.log(`${timestamp} 💾 [ATOMIC] Data cached for ${key} (TTL: ${duration}s) ${userInfo}`);
            }
            
            // Always resolve the promise even if skipping cache
            // This ensures pending requests get the data
            resolvePromise(data);
            
            // Clean up the pending promise
            delete pendingPromises[key];
            
            // Call original json function
            originalJson.call(this, data);
        };
        
        // Handle errors
        const originalEnd = res.end;
        res.end = function(...args) {
            // If we get here without calling res.json, it's likely an error
            if (res.statusCode >= 400 && pendingPromises[key]) {
                rejectPromise(new Error(`Request failed with status ${res.statusCode}`));
                delete pendingPromises[key];
                console.log(`${timestamp} ❌ [ATOMIC] Request failed with status ${res.statusCode} for ${key} ${userInfo}`);
            }
            originalEnd.apply(this, args);
        };
        
        // Set a safety timeout for this request to prevent deadlocks
        // This handles cases where res.json or res.end might not be called
        const safetyTimeout = setTimeout(() => {
            if (pendingPromises[key]) {
                console.log(`${timestamp} ⚠️ [ATOMIC] Safety timeout triggered for ${key} ${userInfo}`);
                rejectPromise(new Error(`Request processing timeout after ${waitTimeout * 2}ms for ${key}`));
                delete pendingPromises[key];
            }
        }, waitTimeout * 2); // Double the wait timeout for the original request
        
        // Clean up the timeout when response is finished
        res.on('finish', () => {
            clearTimeout(safetyTimeout);
        });
        
        next();
    };
};

// Function to clear cache for specific pattern
const clearCache = (pattern) => {
    const keys = cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    matchingKeys.forEach(key => cache.del(key));
    console.log(`Cleared ${matchingKeys.length} cache entries matching: ${pattern}`);
    
    // Also clear any pending promises for those keys
    Object.keys(pendingPromises).forEach(key => {
        if (key.includes(pattern)) {
            delete pendingPromises[key];
        }
    });
};

// Function to clear all cache
const clearAllCache = () => {
    cache.flushAll();
    // Also clear all pending promises
    Object.keys(pendingPromises).forEach(key => {
        delete pendingPromises[key];
    });
    console.log('All cache and pending requests cleared');
};

export { 
    cacheMiddleware,
    atomicCacheMiddleware,
    clearCache, 
    clearAllCache,
    cache 
};