import fetch from 'node-fetch';
import express from 'express';       
import jwt from "jsonwebtoken";
import cors from "cors";
import http from "http";
import https from "https";
import fs from "fs";
import * as errors from './errors.js';
import { ERROR_CODE } from './errors.js';

import hotel from './controller/hotel.js';

// this file runs in sequential order, so import the errors module should always be at the bottom

const app = express();
const PORT = process.env.PORT || 3000;

// Built-in middleware to parse JSON bodies
app.use(express.json());

// Configure CORS to only allow requests from localhost:5173 or a specific dev frontend link
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5174', // Default to localhost if not set
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Basic route
app.get('/', (req, res, next) => {
  res.send('Welcome to the Hotel API!');
});

app.use('/hotels', hotel.router);

// Proxy route to fetch hotels from external API
app.get('/api/hotels', async (req, res) => {
  const { destination_id } = req.query;

  if (!destination_id) {
    return res.status(400).json({ error: 'Missing destination_id' });
  }

  try {
    const response = await fetch(`https://hotelapi.loyalty.dev/api/hotels?destination_id=${destination_id}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error fetching from external API:', err);
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
});

// Example resource route
app.get('/hotels', (req, res, next) => {
  // placeholder data
  res.json([
    { id: 1, name: 'Seaside Inn', city: 'Miami' },
    { id: 2, name: 'Mountain Lodge', city: 'Aspen' }
  ]);
});

// Hotel Page Route
app.get('/hotel/:id', (req, res) => {
    const hotelId = req.params.id;
    res.json({ id: hotelId, name: 'Sample Hotel', city: 'Sample City' });
  });

    app.get('/api/hotels/prices', async (req, res) => {
    const { destination_id, checkin, checkout, lang, currency, country_code, guests, partner_id } = req.query;

    if (!destination_id || !checkin || !checkout || !lang || !currency || !country_code || !guests || !partner_id) {
      return res.status(400).json({ error: 'Missing required query parameters' });
    }

    try {
      const url = `https://hotelapi.loyalty.dev/api/hotels/prices?destination_id=${destination_id}&checkin=${checkin}&checkout=${checkout}&lang=${lang}&currency=${currency}&country_code=${country_code}&guests=${guests}&partner_id=${partner_id}`;
      const response = await fetch(url);
      const data = await response.json();
      res.json(data.hotels || []); // ✅ return only the array of hotel prices
    } catch (err) {
      console.error('Error fetching hotel prices:', err);
      res.status(500).json({ error: 'Failed to fetch hotel prices' });
    }
  });

// Example route to trigger an error
// This route is just for demonstration purposes to show how the error handling works
// You can remove this route in production
// It will trigger a 404 error when accessed
// You can access this route by going to http://localhost:3000/error
app.get('/error',(req, res, next) => {
  next('This is an example error!'); // This will trigger the 404 error handler
})

// 404
app.use((req, res, next) => next(new errors.UrlNotFoundError(`${req.method} ${req.originalUrl} Not Found`)));
// if u call next() without parameter, it will be passed on to the next middleware to handle it, auto jump
// but if u call next(parameter) with parameter, the parameter will be passed to the error parameter of the next middleware

// error handler
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
    // Console.error for quick debugging using console
    console.error(error); // eslint-disable-line no-console

    // Extract information
    let status = 500;
    let code = ERROR_CODE.UNEXPECTED_ERROR;
    let message = error || 'Unexpected Error!';
    const reason = error.message;

    // Special case of errors
    if (error instanceof errors.UrlNotFoundError) {
        status = 404;
        code = ERROR_CODE.URL_NOT_FOUND;
        message = `Resource not found`;
    }

    const payload = { code, error: message, reason };

    // Log and respond accordingly.
    return res.status(status).json(payload);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});