import { pool } from '../config/database.js';

// SQL for creating the bookings table
const createBookingsTable = `
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(255) PRIMARY KEY,
  destination_id VARCHAR(255),
  hotel_id VARCHAR(255),
  
  -- Booking display info
  start_date DATE,
  end_date DATE,
  nights INT,
  adults INT,
  children INT DEFAULT 0,
  message_to_hotel TEXT,
  room_types JSON,
  
  -- Price info
  total_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'SGD',
  
  -- Guest info
  salutation VARCHAR(10),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100) NOT NULL,
  
  -- Payment info (SECURE - only references!)
  payment_reference VARCHAR(255),
  masked_card_number VARCHAR(20),
  
  -- Billing address (stored as JSON for flexibility)
  billing_address JSON,
  
  -- System fields
  booking_status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_hotel_id (hotel_id),
  INDEX idx_destination_id (destination_id),
  INDEX idx_booking_dates (start_date, end_date),
  INDEX idx_guest_email (email),
  INDEX idx_booking_status (booking_status)
);
`;

// SQL for creating users table (for authentication)
const createUsersTable = `
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
`;

// SQL for creating payment sessions table (temporary payment data)
const createPaymentSessionsTable = `
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
  
  INDEX idx_booking_id (booking_id),
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
);
`;

async function createTables() {
    try {
        console.log('Creating database tables...');
        
        // Create all tables
        await pool.execute(createUsersTable);
        console.log('Users table created/verified');
        
        await pool.execute(createBookingsTable);
        console.log('Bookings table created/verified');
        
        await pool.execute(createPaymentSessionsTable);
        console.log('Payment sessions table created/verified');
        
        console.log('All database tables ready!');
        
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
}

async function dropTables() {
    try {
        console.log('Dropping all tables...');
        
        await pool.execute('DROP TABLE IF EXISTS payment_sessions');
        await pool.execute('DROP TABLE IF EXISTS bookings');
        await pool.execute('DROP TABLE IF EXISTS users');
        
        console.log('All tables dropped');
        
    } catch (error) {
        console.error('Error dropping tables:', error);
        throw error;
    }
}

export { createTables, dropTables };
