import express from 'express';
import * as errors from '../errors.js';

import hotel from '../model/hotel.js';

const router = express.Router();

router.get('/', (req, res, next) => {
    // Fetch all hotels from destination_id
    var destination_id = req.query.destination_id;
    
    hotel.find(destination_id)
        .then((hotels) => {
            if (hotels.length != 0) {
                res.status(200).send(hotels);
            }
        })
        .catch(next);
});

// GET Hotel by ID
// Cleans up the information before sending it back
router.get('/:id', (req, res, next) => {
    const hotelId = req.params.id;
    hotel.findById(hotelId)
        .then((hotelData) => {
            res.status(200).send(hotelData);
        })
        .catch(next);
});

export default { router };