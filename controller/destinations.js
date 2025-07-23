import express from 'express';
import destinations from '../model/destinations.js';

const router = express.Router();

// GET /destinations/search?q=query - Search destinations for autocomplete
router.get('/search', (req, res, next) => {
    try {
        const query = req.query.q;
        const results = destinations.search(query);
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
});

// GET /destinations/:uid - Get specific destination by UID
router.get('/:uid', (req, res, next) => {
    try {
        const { uid } = req.params;
        const destination = destinations.getById(uid);
        
        if (!destination) {
            return res.status(404).json({ error: 'Destination not found' });
        }
        
        res.status(200).json(destination);
    } catch (error) {
        next(error);
    }
});

export default { router };
