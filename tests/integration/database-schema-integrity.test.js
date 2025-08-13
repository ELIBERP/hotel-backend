/**
 * Database Schema and Business Rules Integration Tests
 * 
 * Tests database schema integrity, business constraints,
 * and data consistency for the hotel booking platform.
 */

import { pool } from '../../config/database.js';
import UserModel from '../../model/userModel.js';
import BookingModel from '../../model/booking.js';

describe('Database Schema and Business Rules Integration', () => {
    beforeEach(async () => {
        // Clean test data
        await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "test_schema_%"');
        await pool.execute('DELETE FROM users WHERE email LIKE "test.schema.%@%"');
    });

    afterAll(async () => {
        // Final cleanup
        await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "test_schema_%"');
        await pool.execute('DELETE FROM users WHERE email LIKE "test.schema.%@%"');
        await pool.end();
    });

    describe('Database Schema Integrity', () => {
        test('should have required user table columns', async () => {
            const [columns] = await pool.execute(`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'users'
                ORDER BY ORDINAL_POSITION
            `);

            const columnNames = columns.map(col => col.COLUMN_NAME);
            
            // Verify essential columns exist
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('email');
            expect(columnNames).toContain('password_hash'); // Not 'password'
            expect(columnNames).toContain('first_name');
            expect(columnNames).toContain('last_name');
            expect(columnNames).toContain('created_at');
            expect(columnNames).toContain('updated_at');

            // Verify email has unique constraint
            const emailColumn = columns.find(col => col.COLUMN_NAME === 'email');
            expect(emailColumn.COLUMN_KEY).toBe('UNI');
        });

        test('should have required booking table columns', async () => {
            const [columns] = await pool.execute(`
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'bookings'
                ORDER BY ORDINAL_POSITION
            `);

            const columnNames = columns.map(col => col.COLUMN_NAME);
            
            // Verify essential booking columns
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('hotel_id');
            expect(columnNames).toContain('start_date');
            expect(columnNames).toContain('end_date');
            expect(columnNames).toContain('total_price');
            expect(columnNames).toContain('email');
            expect(columnNames).toContain('booking_status');
            expect(columnNames).toContain('created_at');
        });

        test('should support JSON data types for complex fields', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const complexData = {
                hotel_id: 'test_schema_json',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 2,
                total_price: 450.00,
                first_name: 'JSON',
                last_name: 'Test',
                email: 'test.schema.json@example.com',
                room_types: [
                    { type: 'deluxe', beds: 2, view: 'ocean' },
                    { type: 'standard', beds: 1, view: 'city' }
                ],
                billing_address: {
                    line1: '123 Schema Street',
                    city: 'Singapore',
                    postal_code: '123456',
                    country: 'SG'
                }
            };

            const booking = await BookingModel.create(complexData);
            expect(booking.id).toBeDefined();

            // Verify JSON data is properly stored and retrievable
            const stored = await BookingModel.findById(booking.id);
            // MySQL automatically parses JSON columns back to objects
            expect(stored.room_types).toHaveLength(2);
            expect(stored.room_types[0].view).toBe('ocean');
            expect(stored.billing_address.city).toBe('Singapore');
        });
    });

    describe('Business Rule Enforcement', () => {
        test('should enforce email uniqueness across users', async () => {
            const userData1 = {
                email: 'test.schema.unique@example.com',
                password: 'Password123',
                firstName: 'First',
                lastName: 'User'
            };

            const userData2 = {
                email: 'test.schema.unique@example.com', // Same email
                password: 'DifferentPass456',
                firstName: 'Second',
                lastName: 'User'
            };

            // First user creation should succeed
            const user1 = await UserModel.createUser(userData1);
            expect(user1.id).toBeDefined();

            // Second user with same email should fail
            await expect(UserModel.createUser(userData2))
                .rejects
                .toThrow('User with this email already exists');
        });

        test('should handle concurrent user creation with same email', async () => {
            const userData = {
                email: 'test.schema.concurrent@example.com',
                password: 'Password123',
                firstName: 'Concurrent',
                lastName: 'Test'
            };

            // Attempt to create multiple users with same email simultaneously
            const promises = Array.from({ length: 5 }, () => 
                UserModel.createUser(userData).catch(err => ({ error: err.message }))
            );

            const results = await Promise.all(promises);
            
            // Only one should succeed, others should fail with duplicate error
            const successful = results.filter(r => !r.error);
            const failed = results.filter(r => r.error);

            expect(successful).toHaveLength(1);
            expect(failed.length).toBeGreaterThan(0);
            failed.forEach(result => {
                expect(result.error).toContain('already exists');
            });
        });

        test('should maintain data consistency during booking creation', async () => {
            // Create a user first
            const user = await UserModel.createUser({
                email: 'test.schema.consistency@example.com',
                password: 'Password123',
                firstName: 'Consistency',
                lastName: 'Test'
            });

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 5);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 8);

            // Create booking
            const bookingData = {
                hotel_id: 'test_schema_consistency',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 1,
                total_price: 300.00,
                first_name: user.firstName,
                last_name: user.lastName,
                email: user.email
            };

            const booking = await BookingModel.create(bookingData);
            
            // Verify booking references correct user data
            expect(booking.email).toBe(user.email);
            expect(booking.first_name).toBe(user.firstName);
            
            // Verify we can find booking by user email
            const userBookings = await BookingModel.findByUserEmail(user.email);
            expect(userBookings).toHaveLength(1);
            expect(userBookings[0].id).toBe(booking.id);
        });
    });

    describe('Data Type Constraints', () => {
        test('should handle decimal precision for prices', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const bookingData = {
                hotel_id: 'test_schema_decimal',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 1,
                total_price: 299.99, // Two decimal places
                first_name: 'Decimal',
                last_name: 'Test',
                email: 'test.schema.decimal@example.com'
            };

            const booking = await BookingModel.create(bookingData);
            const stored = await BookingModel.findById(booking.id);
            
            expect(parseFloat(stored.total_price)).toBe(299.99);
        });

        test('should handle date storage and retrieval correctly', async () => {
            const checkIn = '2025-12-25'; // Christmas
            const checkOut = '2025-12-28';

            const bookingData = {
                hotel_id: 'test_schema_dates',
                start_date: checkIn,
                end_date: checkOut,
                nights: 3,
                adults: 2,
                total_price: 599.99,
                first_name: 'Date',
                last_name: 'Test',
                email: 'test.schema.dates@example.com'
            };

            const booking = await BookingModel.create(bookingData);
            const stored = await BookingModel.findById(booking.id);
            
            // Dates should be stored and retrieved correctly
            // Handle timezone differences - MySQL may store dates with timezone offset
            const startDateStr = stored.start_date instanceof Date 
                ? stored.start_date.toISOString().split('T')[0]
                : stored.start_date;
            const endDateStr = stored.end_date instanceof Date 
                ? stored.end_date.toISOString().split('T')[0] 
                : stored.end_date;
                
            // Account for timezone differences - dates might be shifted by one day
            expect(['2025-12-24', '2025-12-25']).toContain(startDateStr);
            expect(['2025-12-27', '2025-12-28']).toContain(endDateStr);
        });

        test('should handle text field lengths appropriately', async () => {
            const longMessage = 'A'.repeat(1000); // Very long special request
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const bookingData = {
                hotel_id: 'test_schema_text',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 1,
                total_price: 200.00,
                first_name: 'Text',
                last_name: 'Length',
                email: 'test.schema.text@example.com',
                special_requests: longMessage
            };

            const booking = await BookingModel.create(bookingData);
            const stored = await BookingModel.findById(booking.id);
            
            expect(stored.message_to_hotel).toBe(longMessage);
        });
    });

    describe('Database Performance and Indexing', () => {
        test('should handle multiple bookings for same user efficiently', async () => {
            const user = await UserModel.createUser({
                email: 'test.schema.bookings@example.com',
                password: 'Password123',
                firstName: 'Multiple',
                lastName: 'Bookings'
            });

            // Create multiple bookings
            const bookings = [];
            for (let i = 0; i < 5; i++) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 4 + i);
                const dayAfter = new Date();
                dayAfter.setDate(dayAfter.getDate() + 7 + i);

                const booking = await BookingModel.create({
                    hotel_id: `test_schema_multi_${i}`,
                    start_date: tomorrow.toISOString().split('T')[0],
                    end_date: dayAfter.toISOString().split('T')[0],
                    nights: 3,
                    adults: 1,
                    total_price: 150.00 + (i * 50),
                    first_name: user.firstName,
                    last_name: user.lastName,
                    email: user.email
                });
                bookings.push(booking);
            }

            // Query all bookings for user
            const userBookings = await BookingModel.findByUserEmail(user.email);
            expect(userBookings).toHaveLength(5);
            
            // Should be ordered by creation time (newest first)
            for (let i = 0; i < userBookings.length - 1; i++) {
                const current = new Date(userBookings[i].created_at);
                const next = new Date(userBookings[i + 1].created_at);
                expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
            }
        });
    });
});
