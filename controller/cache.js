import express from 'express';
import { cache, clearCache, clearAllCache } from '../middleware/cache.js';

const router = express.Router();

// GET /cache/stats - Get cache statistics
router.get('/stats', (req, res) => {
    const stats = cache.getStats();
    const keys = cache.keys();
    
    res.json({
        stats,
        totalKeys: keys.length,
        keysList: keys,
        timestamp: new Date().toISOString()
    });
});

// GET /cache/keys - Get all cached keys with their data and TTL
router.get('/keys', (req, res) => {
    const keys = cache.keys();
    const cacheData = {};
    
    keys.forEach(key => {
        const ttl = cache.getTtl(key);
        const timeLeft = ttl ? Math.round((ttl - Date.now()) / 1000) : 0;
        
        cacheData[key] = {
            data: cache.get(key),
            ttl: timeLeft,
            expiresAt: ttl ? new Date(ttl).toISOString() : null
        };
    });
    
    res.json({
        totalKeys: keys.length,
        cache: cacheData,
        timestamp: new Date().toISOString()
    });
});

// GET /cache/key/:key - Get specific cached key
router.get('/key/:key', (req, res) => {
    const key = decodeURIComponent(req.params.key);
    const data = cache.get(key);
    
    if (data === undefined) {
        return res.status(404).json({
            message: 'Key not found in cache',
            key: key
        });
    }
    
    const ttl = cache.getTtl(key);
    const timeLeft = ttl ? Math.round((ttl - Date.now()) / 1000) : 0;
    
    res.json({
        key: key,
        data: data,
        ttl: timeLeft,
        expiresAt: ttl ? new Date(ttl).toISOString() : null
    });
});

// DELETE /cache/clear - Clear all cache
router.delete('/clear', (req, res) => {
    const keysBeforeClear = cache.keys().length;
    clearAllCache();
    
    res.json({ 
        message: 'All cache cleared',
        keysCleared: keysBeforeClear,
        timestamp: new Date().toISOString()
    });
});

// DELETE /cache/clear/:pattern - Clear cache by pattern
router.delete('/clear/:pattern', (req, res) => {
    const pattern = req.params.pattern;
    const keysBefore = cache.keys().length;
    
    clearCache(pattern);
    
    const keysAfter = cache.keys().length;
    const keysCleared = keysBefore - keysAfter;
    
    res.json({ 
        message: `Cache cleared for pattern: ${pattern}`,
        pattern: pattern,
        keysCleared: keysCleared,
        timestamp: new Date().toISOString()
    });
});

// DELETE /cache/key/:key - Delete specific cache key
router.delete('/key/:key', (req, res) => {
    const key = decodeURIComponent(req.params.key);
    const existed = cache.has(key);
    
    if (!existed) {
        return res.status(404).json({
            message: 'Key not found in cache',
            key: key
        });
    }
    
    cache.del(key);
    
    res.json({
        message: 'Cache key deleted',
        key: key,
        timestamp: new Date().toISOString()
    });
});

export default { router };