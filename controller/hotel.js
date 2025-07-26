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
    const guests = req.query.guests;
    const partner_id = req.query.partner_id;

    const query  = {
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


// Proxy route to fetch hotels using hotel model (async/await)
router.get('/api/hotels', async (req, res) => {
  const { destination_id } = req.query;
  if (!destination_id) {
    return res.status(400).json({ error: 'Missing destination_id' });
  }
  try {
    const data = await hotel.find(destination_id);
    res.json(data);
  } catch (err) {
    console.error('Error fetching hotels:', err);
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
});

// Hotel Page Route using hotel model (async/await)
router.get('/api/hotels/:id', async (req, res) => {
  const hotelId = req.params.id;
  try {
    const data = await hotel.findById(hotelId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching hotel by ID:', err);
    res.status(500).json({ error: 'Failed to fetch hotel by ID' });
  }
});

// Hotel prices by ID using hotel model (async/await)
router.get('/api/hotels/:id/prices', async (req, res) => {
  const hotelId = req.params.id;
  const { destination_id, checkin, checkout, lang, currency, country_code, guests, partner_id } = req.query;
  if (!destination_id || !checkin || !checkout || !lang || !currency || !country_code || !guests || !partner_id) {
    return res.status(400).json({ error: 'Missing required query parameters' });
  }
  try {
    const query = { destination_id, checkin, checkout, lang, currency, country_code, guests, partner_id };
    const data = await hotel.findRoomsByID(hotelId, query);
    res.json(data);
  } catch (err) {
    console.error('Error fetching hotel prices:', err);
    res.status(500).json({ error: 'Failed to fetch hotel prices' });
  }
});

export default { router };