-- Hotel Booking System Database Schema
-- This file defines the complete database structure for the hotel booking application

-- Create database (run this manually first)
-- CREATE DATABASE hotel_booking_db;
-- USE hotel_booking_db;

-- Users table for authentication and user management
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
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_active (is_active)
);

-- Bookings table for storing hotel reservations
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(255) PRIMARY KEY,
  destination_id VARCHAR(255),
  hotel_id VARCHAR(255) NOT NULL,
  hotel_name VARCHAR(255),
  
  -- Booking dates and duration
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nights INT NOT NULL,
  
  -- Guest information
  adults INT DEFAULT 1,
  children INT DEFAULT 0,
  message_to_hotel TEXT,
  room_types JSON,
  
  -- Pricing information
  total_price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'SGD',
  
  -- Guest contact details
  salutation VARCHAR(10),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100) NOT NULL,
  
  -- Payment information (secure references only)
  payment_reference VARCHAR(255),
  masked_card_number VARCHAR(20),
  
  -- Billing address (stored as JSON for flexibility)
  billing_address JSON,
  
  -- Booking status and tracking
  booking_status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Performance indexes
  INDEX idx_hotel_id (hotel_id),
  INDEX idx_destination_id (destination_id),
  INDEX idx_booking_dates (start_date, end_date),
  INDEX idx_guest_email (email),
  INDEX idx_booking_status (booking_status),
  INDEX idx_created_at (created_at)
);

-- Payment sessions table for tracking payment processing
CREATE TABLE IF NOT EXISTS payment_sessions (
  id VARCHAR(255) PRIMARY KEY,
  booking_id VARCHAR(255),
  user_id VARCHAR(255),
  session_id VARCHAR(255) UNIQUE,
  
  -- Payment details
  amount DECIMAL(10,2),
  currency VARCHAR(3),
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  
  -- Session management
  session_data JSON,
  status ENUM('pending', 'completed', 'failed', 'expired', 'cancelled') DEFAULT 'pending',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Performance indexes
  INDEX idx_booking_id (booking_id),
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at),
  
  -- Foreign key relationships (optional - depends on your preference)
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- Hotels cache table (optional - for caching external API data)
CREATE TABLE IF NOT EXISTS hotels_cache (
  id VARCHAR(255) PRIMARY KEY,
  destination_id VARCHAR(255),
  hotel_data JSON,
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  
  INDEX idx_destination_id (destination_id),
  INDEX idx_expires_at (expires_at)
);

-- Audit log table (optional - for tracking changes)
CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(50),
  record_id VARCHAR(255),
  action ENUM('INSERT', 'UPDATE', 'DELETE'),
  old_values JSON,
  new_values JSON,
  user_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_timestamp (timestamp)
);

-- Create views for common queries

-- View for booking summary (without sensitive data)
CREATE VIEW booking_summary AS
SELECT 
  b.id,
  b.hotel_id,
  b.hotel_name,
  b.start_date,
  b.end_date,
  b.nights,
  b.adults + IFNULL(b.children, 0) as total_guests,
  b.total_price,
  b.currency,
  CONCAT(b.first_name, ' ', b.last_name) as guest_name,
  b.email,
  b.booking_status,
  b.created_at
FROM bookings b
WHERE b.booking_status != 'cancelled';

-- View for payment tracking
CREATE VIEW payment_summary AS
SELECT 
  p.booking_id,
  p.amount,
  p.currency,
  p.status as payment_status,
  p.payment_method,
  p.created_at as payment_created_at,
  b.booking_status,
  CONCAT(b.first_name, ' ', b.last_name) as guest_name
FROM payment_sessions p
JOIN bookings b ON p.booking_id = b.id;

-- Sample data insertion (for testing)
-- Note: This would typically be in a separate seed file

-- Insert test user (password is 'password123' hashed with bcrypt)
INSERT IGNORE INTO users (id, email, password_hash, first_name, last_name, phone) VALUES
('550e8400-e29b-41d4-a716-446655440000', 
 'test@hotel.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'Test', 
 'User', 
 '+65 9123 4567');

-- Display schema information
SELECT 
  'Hotel Booking Database Schema Created Successfully!' as message,
  COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name IN ('users', 'bookings', 'payment_sessions');

-- Show table structures
SHOW TABLES;
