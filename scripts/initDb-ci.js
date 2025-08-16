#!/usr/bin/env node

// Faster database initialization for CI environments
// Skips verbose logging and connection testing for speed

import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';

// Direct MySQL connection for CI (faster than pool)
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true
};

// Combined SQL for all tables (single execution)
const createAllTablesSQL = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  role ENUM('user', 'admin') DEFAULT 'user',
  email_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_role (role)
);

CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(255) PRIMARY KEY,
  destination_id VARCHAR(255),
  hotel_id VARCHAR(255),
  
  start_date DATE,
  end_date DATE,
  nights INT,
  adults INT,
  children INT DEFAULT 0,
  message_to_hotel TEXT,
  room_types JSON,
  
  total_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'SGD',
  
  salutation VARCHAR(10),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100) NOT NULL,
  
  payment_reference VARCHAR(255),
  masked_card_number VARCHAR(20),
  
  billing_address JSON,
  
  booking_status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_hotel_id (hotel_id),
  INDEX idx_destination_id (destination_id),
  INDEX idx_booking_dates (start_date, end_date),
  INDEX idx_guest_email (email),
  INDEX idx_booking_status (booking_status)
);

CREATE TABLE IF NOT EXISTS payment_sessions (
  id VARCHAR(255) PRIMARY KEY,
  booking_id VARCHAR(255),
  user_id VARCHAR(255),
  session_id VARCHAR(255) UNIQUE,
  
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  
  session_data JSON,
  status ENUM('pending', 'completed', 'failed', 'expired', 'cancelled') DEFAULT 'pending',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_booking_id (booking_id),
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
);
`;

async function initDatabaseCI() {
    let connection;
    try {
        console.log('CI: Initializing database tables...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // Execute all table creation in one go
        await connection.execute(createAllTablesSQL);
        
        console.log('CI: Database ready for testing');
        
    } catch (error) {
        console.error('CI Database init failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the initialization
initDatabaseCI();
