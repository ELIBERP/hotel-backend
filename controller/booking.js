import express from 'express';
import booking from '../model/booking.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const bookingData = req.body;
    const result = await booking.create(bookingData);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default { router };