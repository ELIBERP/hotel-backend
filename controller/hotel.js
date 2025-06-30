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

export default { router };