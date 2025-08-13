import './config/config.js';   
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
import booking from './controller/bookingController.js';
import { validatePassword } from './middleware/auth.js';
import cache from './controller/cache.js';

// Import route modules
import paymentRoutes from './routes/payment.js';
import testPaymentRoutes from './routes/test-payment.js';

// this file runs in sequential order, so import the errors module should always be at the bottom
import { testConnection } from './config/database.js';
console.log(testConnection());

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow requests from both frontend ports
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173', // Default frontend port
  'http://localhost:5174', // Vite dev server alternate port
  'http://localhost:3000', // Backend port for testing
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

// Stripe webhook - MUST come before express.json() middleware and needs raw body
if (booking.webhookRouter) {
    app.use('/api/stripe', booking.webhookRouter);
}

// Built-in middleware to parse JSON bodies (AFTER webhook routes)
app.use(express.json());

// Basic route
app.get('/', (req, res, next) => {
  res.send('Welcome to the Hotel API!');
});

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is working correctly',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

// Authentication routes - must come before other routes
app.use('/auth', auth.router);

// 🔓 PUBLIC booking routes - no authentication required (different path to avoid conflicts)
if (booking.publicRouter) {
    app.use('/api/public/bookings', booking.publicRouter);
}

// Protected booking routes - requires JWT authentication (main booking controller)
app.use('/api/bookings', booking.router);

// Add direct /bookings route for frontend compatibility
app.use('/bookings', booking.router);

// Payment processing routes
app.use('/api/payment', paymentRoutes);

// Test payment routes (for testing without database)
app.use('/api/test', testPaymentRoutes);

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