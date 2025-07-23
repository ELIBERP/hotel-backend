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

// GET Hotel Rooms by ID
router.get('/:id/prices', (req, res, next) => {
    const hotelId = req.params.id;
    
    // Get the queries like ?checkin=...&checkout=...
    const destination_id = req.query.destination_id;
    const checkin = req.query.checkin;
    const checkout = req.query.checkout;
    const lang = req.query.lang;
    const currency = req.query.currency;
    const country_code = req.query.country_code;
    let guests = req.query.guests;
    const partner_id = req.query.partner_id;

    // Validate required fields
    if (!destination_id) {
        return res.status(400).json({ error: 'destination_id is required' });
    }

    // Validate and parse dates
    if (checkin) {
        const checkinDate = new Date(checkin);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (isNaN(checkinDate.getTime())) {
            return res.status(400).json({ error: 'Invalid checkin date format' });
        }
        
        if (checkinDate < today) {
            return res.status(400).json({ error: 'Check-in date cannot be in the past' });
        }
    }

    if (checkout) {
        const checkoutDate = new Date(checkout);
        
        if (isNaN(checkoutDate.getTime())) {
            return res.status(400).json({ error: 'Invalid checkout date format' });
        }
        
        if (checkin) {
            const checkinDate = new Date(checkin);
            if (checkoutDate <= checkinDate) {
                return res.status(400).json({ error: 'Check-out date must be after check-in date' });
            }
        }
    }

    // Validate and convert guests
    if (guests) {
        const guestCount = parseInt(guests, 10);
        
        if (isNaN(guestCount) || guestCount <= 0 || guestCount > 10) {
            return res.status(400).json({ error: 'Invalid guest count. Must be between 1 and 10' });
        }
        
        guests = guestCount;
    } else {
        guests = 2; // Default guest count
    }

    const query = {
        destination_id,
        checkin,
        checkout,
        lang,
        currency,
        country_code,
        guests,
        partner_id
    };

    hotel.findRoomsByID(hotelId, query)
        .then((roomsData) => {
            res.status(200).send(roomsData);
        })
        .catch(next);
});

export default { router };