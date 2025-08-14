/**
 * Hotel Platform End-to-End Database Integration Tests
 * 
 * Tests complete user journeys and business workflows
 * that span multiple database operations and models.
 */

import { pool } from '../../config/database.js';
import UserModel from '../../model/userModel.js';
import BookingModel from '../../model/booking.js';

describe('Hotel Platform End-to-End Database Integration', () => {
    beforeEach(async () => {
        // Clean all test data
        await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "test_e2e_%"');
        await pool.execute('DELETE FROM users WHERE email LIKE "test.e2e.%@%"');
    });

    afterAll(async () => {
        // Final cleanup
        await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "test_e2e_%"');
        await pool.execute('DELETE FROM users WHERE email LIKE "test.e2e.%@%"');
        await pool.end();
    });

    describe('Complete User Registration and Booking Journey', () => {
        test('should handle booking cancellation workflow', async () => {
            // Create user and booking
            const user = await UserModel.createUser({
                email: 'test.e2e.cancel@example.com',
                password: 'Password123',
                firstName: 'Cancel',
                lastName: 'Test'
            });

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 5);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 8);

            const booking = await BookingModel.create({
                hotel_id: 'test_e2e_cancellation',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 1,
                total_price: 450.00,
                first_name: user.firstName,
                last_name: user.lastName,
                email: user.email
            });

            // Cancel booking
            const cancelled = await BookingModel.updateStatus(booking.id, 'cancelled');
            expect(cancelled).toBe(true);

            // Verify cancellation
            const cancelledBooking = await BookingModel.findById(booking.id);
            expect(cancelledBooking.booking_status).toBe('cancelled');

            // User can still view cancelled bookings
            const userBookings = await BookingModel.findByUserEmail(user.email);
            expect(userBookings).toHaveLength(1);
            expect(userBookings[0].booking_status).toBe('cancelled');
        });
    });

    describe('Multiple User Scenarios', () => {
        test('should handle user account deletion with booking history preservation', async () => {
            // Create user with bookings
            const user = await UserModel.createUser({
                email: 'test.e2e.delete@example.com',
                password: 'Password123',
                firstName: 'Delete',
                lastName: 'Me'
            });

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 6);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 9);

            const booking = await BookingModel.create({
                hotel_id: 'test_e2e_user_deletion',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 1,
                total_price: 300.00,
                first_name: user.firstName,
                last_name: user.lastName,
                email: user.email
            });

            // Delete user (GDPR compliance)
            const deleted = await UserModel.deleteUser(user.id);
            expect(deleted).toBe(true);

            // Verify user is anonymized
            const deletedUser = await UserModel.findById(user.id);
            expect(deletedUser.email).toContain('DELETED_');
            // Note: deleted_at timestamp would be added in future schema updates

            // Booking should still exist for record keeping
            const existingBooking = await BookingModel.findById(booking.id);
            expect(existingBooking).toBeDefined();
            expect(existingBooking.email).toBe(user.email); // Original email preserved in booking
        });
    });

    describe('Business Logic Integration', () => {
        test('should validate booking dates across database operations', async () => {
            const user = await UserModel.createUser({
                email: 'test.e2e.dates@example.com',
                password: 'Password123',
                firstName: 'Date',
                lastName: 'Validator'
            });

            // Test valid future dates
            const validStartDate = new Date();
            validStartDate.setDate(validStartDate.getDate() + 7);
            const validEndDate = new Date();
            validEndDate.setDate(validEndDate.getDate() + 10);

            const validBookingData = {
                hotel_id: 'test_e2e_date_validation',
                start_date: validStartDate.toISOString().split('T')[0],
                end_date: validEndDate.toISOString().split('T')[0],
                nights: 3,
                adults: 1,
                total_price: 450.00,
                first_name: user.firstName,
                last_name: user.lastName,
                email: user.email
            };

            // Validate before creation
            const validationErrors = BookingModel.validateBookingData(validBookingData);
            expect(validationErrors).toHaveLength(0);

            // Create valid booking
            const booking = await BookingModel.create(validBookingData);
            expect(booking.id).toBeDefined();

            // Test invalid dates (past dates)
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const invalidBookingData = {
                ...validBookingData,
                start_date: pastDate.toISOString().split('T')[0]
            };

            const invalidErrors = BookingModel.validateBookingData(invalidBookingData);
            expect(invalidErrors).toContain('Check-in date cannot be in the past');
        });

        test('should maintain referential integrity between users and bookings', async () => {
            // Create user
            const user = await UserModel.createUser({
                email: 'test.e2e.integrity@example.com',
                password: 'Password123',
                firstName: 'Integrity',
                lastName: 'Test'
            });

            // Create booking linked to user
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 5);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 8);

            const booking = await BookingModel.create({
                hotel_id: 'test_e2e_integrity_check',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 1,
                total_price: 350.00,
                first_name: user.firstName,
                last_name: user.lastName,
                email: user.email // Links to user
            });

            // Verify linkage
            const userBookings = await BookingModel.findByUserEmail(user.email);
            expect(userBookings).toHaveLength(1);
            expect(userBookings[0].id).toBe(booking.id);

            const foundUser = await UserModel.findByEmail(user.email);
            expect(foundUser.first_name).toBe(booking.first_name);
            expect(foundUser.last_name).toBe(booking.last_name);
        });

        test('should handle concurrent booking operations safely', async () => {
            // Create user
            const user = await UserModel.createUser({
                email: 'test.e2e.concurrent@example.com',
                password: 'Password123',
                firstName: 'Concurrent',
                lastName: 'Test'
            });

            // Attempt multiple concurrent bookings
            const bookingPromises = Array.from({ length: 5 }, (_, i) => {
                const startDate = new Date();
                startDate.setDate(startDate.getDate() + 5 + i);
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + 8 + i);

                return BookingModel.create({
                    hotel_id: `test_e2e_concurrent_${i}`,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    nights: 3,
                    adults: 1,
                    total_price: 250.00 + (i * 25),
                    first_name: user.firstName,
                    last_name: user.lastName,
                    email: user.email
                }).catch(error => ({ error: error.message }));
            });

            const results = await Promise.all(bookingPromises);
            
            // All bookings should succeed (no unique constraints violated)
            const successful = results.filter(r => !r.error);
            expect(successful).toHaveLength(5);

            // Verify all bookings are stored
            const userBookings = await BookingModel.findByUserEmail(user.email);
            expect(userBookings).toHaveLength(5);
        });
    });

    describe('Payment and Security Integration', () => {
        test('should handle secure payment workflow with masked data', async () => {
            const user = await UserModel.createUser({
                email: 'test.e2e.payment@example.com',
                password: 'SecurePassword123!',
                firstName: 'Payment',
                lastName: 'User'
            });

            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 8);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 11);

            // Create booking with payment info
            const booking = await BookingModel.create({
                hotel_id: 'test_e2e_payment_security',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 2,
                total_price: 750.00,
                currency: 'SGD',
                first_name: user.firstName,
                last_name: user.lastName,
                email: user.email,
                phone: '+65 8888 9999',
                masked_card_number: '424242******4242', // Properly masked
                billing_address: {
                    line1: '456 Payment Street',
                    city: 'Singapore',
                    postal_code: '567890',
                    country: 'SG'
                }
            });

            // Process payment (simulate Stripe)
            const paymentRef = 'stripe_pi_secure_payment_123';
            const statusUpdated = await BookingModel.updateStatus(booking.id, 'completed', paymentRef);
            expect(statusUpdated).toBe(true);

            // Verify secure storage
            const completedBooking = await BookingModel.findById(booking.id);
            expect(completedBooking.booking_status).toBe('completed');
            expect(completedBooking.payment_reference).toBe(paymentRef);
            expect(completedBooking.masked_card_number).toBe('424242******4242');
            expect(completedBooking.masked_card_number).not.toMatch(/^\d{16}$/); // No full card numbers

            // MySQL automatically parses JSON back to objects
            expect(completedBooking.billing_address.city).toBe('Singapore');
        });
    });
});
