import express from 'express';       
import jwt from "jsonwebtoken";
import cors from "cors";
import http from "http";
import https from "https";
import fs from "fs";
import * as errors from './errors.js';
import { ERROR_CODE } from './errors.js';

import hotel from './controller/hotel.js';
import auth from './controller/authController.js';
import { validatePassword } from './middleware/auth.js';
import cache from './controller/cache.js';

// this file runs in sequential order, so import the errors module should always be at the bottom

const app = express();
const PORT = process.env.PORT || 3000;

// Built-in middleware to parse JSON bodies
app.use(express.json());

// Configure CORS to only allow requests from localhost:5173 or a specific dev frontend link
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173', // Default to localhost if not set
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

// Authentication routes - must come before other routes
app.use('/auth', auth.router);

// Hotel routes - make sure this comes after auth
app.use('/hotels', hotel.router);
app.use('/cache', cache.router);

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