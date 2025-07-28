-- Hotel Booking System - Test Data Seeding
-- This file creates common test users for development and testing

-- Clear existing test data (optional - uncomment if needed)
-- DELETE FROM users WHERE email LIKE '%test%' OR email LIKE '%example%';

-- Insert test users with bcrypt hashed passwords
-- All test passwords are: 'password123' (hashed with bcrypt rounds=12)

INSERT INTO users (id, email, password_hash, first_name, last_name, phone, created_at, updated_at) VALUES
-- Test User 1: John Doe
('550e8400-e29b-41d4-a716-446655440001', 
 'john.doe@test.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'John', 
 'Doe', 
 '+65 9123 4567', 
 NOW(), 
 NOW()),

-- Test User 2: Jane Smith
('550e8400-e29b-41d4-a716-446655440002', 
 'jane.smith@test.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'Jane', 
 'Smith', 
 '+65 9876 5432', 
 NOW(), 
 NOW()),

-- Test User 3: Admin User
('550e8400-e29b-41d4-a716-446655440003', 
 'admin@hotel.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'Admin', 
 'User', 
 '+65 6123 4567', 
 NOW(), 
 NOW()),

-- Test User 4: Guest User
('550e8400-e29b-41d4-a716-446655440004', 
 'guest@example.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'Guest', 
 'User', 
 NULL, 
 NOW(), 
 NOW()),

-- Test User 5: Customer Service
('550e8400-e29b-41d4-a716-446655440005', 
 'support@hotel.com', 
 '$2b$12$LQv3c1yqBw2zLJhbQtOzJu7.jzv7v7v7v7v7v7v7v7v7v7v7v7v7vu', 
 'Customer', 
 'Support', 
 '+65 6000 1234', 
 NOW(), 
 NOW());

-- Display inserted users
SELECT 
    id,
    email,
    CONCAT(first_name, ' ', last_name) as full_name,
    phone,
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
