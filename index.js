import express from 'express';       
import jwt from "jsonwebtoken";
import cors from "cors";
import http from "http";
import https from "https";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

// Built-in middleware to parse JSON bodies
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Welcome to the Hotel Booking API');
});

// Example resource route
app.get('/hotels', (req, res) => {
  // placeholder data
  res.json([
    { id: 1, name: 'Seaside Inn', city: 'Miami' },
    { id: 2, name: 'Mountain Lodge', city: 'Aspen' }
  ]);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});