-- Hotel Booking System - Database Schema
-- MySQL compatible schema for AWS RDS

-- Drop tables if they exist (comment out in production)
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS users;

-- Users Table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('user', 'admin') DEFAULT 'user',
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bookings Table - Based on booking.js model
CREATE TABLE bookings (
    id VARCHAR(36) PRIMARY KEY,
    destination_id VARCHAR(50),
    hotel_id VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    nights INT NOT NULL,
    adults INT DEFAULT 1,
    children INT DEFAULT 0,
    message_to_hotel TEXT,
    room_types JSON,
    total_price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'SGD',
    salutation VARCHAR(10),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    payment_reference VARCHAR(100),
    masked_card_number VARCHAR(30),
    billing_address JSON,
    booking_status VARCHAR(20) DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_bookings_hotel_id ON bookings(hotel_id);
CREATE INDEX idx_bookings_email ON bookings(email);
CREATE INDEX idx_users_email ON users(email);
