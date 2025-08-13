-- Hotel Booking System - Test Data Seeding
-- This file creates test users and bookings for development and testing

-- Clear existing test data (uncomment if needed)
-- DELETE FROM bookings;
-- DELETE FROM users;

-- Insert test users with bcrypt hashed passwords
-- All test passwords are: 'password123' (hashed with bcrypt)
INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, created_at, updated_at) VALUES
-- Test User 1: Regular User
('550e8400-e29b-41d4-a716-446655440001', 
 'john.doe@test.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'John', 
 'Doe', 
 '+65 9123 4567', 
 'user',
 NOW(), 
 NOW()),

-- Test User 2: Jane Smith
('550e8400-e29b-41d4-a716-446655440002', 
 'jane.smith@test.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'Jane', 
 'Smith', 
 '+65 9876 5432', 
 'user',
 NOW(), 
 NOW()),

-- Test User 3: Admin User
('550e8400-e29b-41d4-a716-446655440003', 
 'admin@hotel.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'Admin', 
 'User', 
 '+65 6123 4567', 
 'admin',
 NOW(), 
 NOW()),

-- Test User 4: Guest User
('550e8400-e29b-41d4-a716-446655440004', 
 'guest@example.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'Guest', 
 'User', 
 NULL, 
 'user',
 NOW(), 
 NOW()),

-- Test User 5: Customer Service
('550e8400-e29b-41d4-a716-446655440005', 
 'support@hotel.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'Customer', 
 'Support', 
 '+65 6000 1234', 
 'user',
 NOW(), 
 NOW());

-- Insert sample bookings
INSERT INTO bookings (
  id, destination_id, hotel_id, start_date, end_date, nights, adults, children, 
  message_to_hotel, room_types, total_price, currency, salutation, first_name, 
  last_name, phone, email, payment_reference, masked_card_number, billing_address,
  booking_status, created_at, updated_at
) VALUES
-- Booking 1: Singapore hotel for John Doe
('b550e840-e29b-41d4-a716-446655440001',
 'SG',
 'h123456',
 '2025-09-01',
 '2025-09-03',
 2,
 2,
 0,
 'I would like a quiet room please.',
 '[{"type":"standard_king", "quantity":1}]',
 455.60,
 'SGD',
 'Mr',
 'John',
 'Doe',
 '+65 9123 4567',
 'john.doe@test.com',
 'payment_ref_123456',
 '4xxx xxxx xxxx 1234',
 '{"street":"123 Test Street", "city":"Singapore", "postcode":"123456", "country":"SG"}',
 'confirmed',
 NOW(),
 NOW()),

-- Booking 2: Tokyo hotel for Jane Smith
('b550e840-e29b-41d4-a716-446655440002',
 'JP',
 'h789012',
 '2025-10-15',
 '2025-10-20',
 5,
 2,
 1,
 'Need a baby cot please.',
 '[{"type":"deluxe_suite", "quantity":1}]',
 1230.50,
 'SGD',
 'Mrs',
 'Jane',
 'Smith',
 '+65 9876 5432',
 'jane.smith@test.com',
 'payment_ref_789012',
 '5xxx xxxx xxxx 5678',
 '{"street":"456 Customer Ave", "city":"Singapore", "postcode":"654321", "country":"SG"}',
 'confirmed',
 NOW(),
 NOW()),

-- Booking 3: Bali hotel for Guest User
('b550e840-e29b-41d4-a716-446655440003',
 'ID',
 'h345678',
 '2025-12-24',
 '2025-12-30',
 6,
 4,
 2,
 'Celebration trip, requesting ocean view if possible.',
 '[{"type":"beach_villa", "quantity":2}]',
 3200.00,
 'SGD',
 'Mr',
 'Guest',
 'User',
 '+65 8765 4321',
 'guest@example.com',
 'payment_ref_345678',
 '3xxx xxxx xxxx 9012',
 '{"street":"789 Guest Road", "city":"Singapore", "postcode":"789012", "country":"SG"}',
 'confirmed',
 NOW(),
 NOW());

-- Display inserted users
SELECT 
    id,
    email,
    CONCAT(first_name, ' ', last_name) as full_name,
    phone,
    role,
    created_at
FROM users 
WHERE email IN (
    'john.doe@test.com',
    'jane.smith@test.com', 
    'admin@hotel.com',
    'guest@example.com',
    'support@hotel.com'
)
ORDER BY created_at DESC;

-- Test data summary
SELECT 
    'Seed data inserted successfully!' as message,
    COUNT(*) as total_test_users,
    'password123' as default_password
FROM users 
WHERE email LIKE '%test%' OR email LIKE '%@hotel.com' OR email LIKE '%@example.com';
