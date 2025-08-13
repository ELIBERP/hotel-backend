/**
 * Booking Management Database Integration Tests
 * 
 * Tests core booking functionality including creation, validation,
 * date handling, and business rules for the hotel booking platform.
 */

import { pool } from '../../config/database.js';
import BookingModel from '../../model/booking.js';
import UserModel from '../../model/userModel.js';

describe('Booking Management Database Integration', () => {
    let testUser;

    beforeAll(async () => {
        // Create a test user for booking tests
        testUser = await UserModel.createUser({
            email: 'test.booking.user@example.com',
            password: 'TestPassword123',
            firstName: 'Booking',
            lastName: 'Tester'
        });
    });

    beforeEach(async () => {
        // Clean test bookings before each test
        await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "test_hotel_%"');
        await pool.execute('DELETE FROM bookings WHERE email LIKE "test.booking%"');
    });

    afterAll(async () => {
        // Final cleanup
        await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "test_hotel_%"');
        await pool.execute('DELETE FROM bookings WHERE email LIKE "test.booking%"');
        await pool.execute('DELETE FROM users WHERE email = "test.booking.user@example.com"');
        await pool.end();
    });

    describe('Booking Creation', () => {
        test('should successfully create a booking with valid data', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4); // 4 days from now
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7); // 7 days from now

            const bookingData = {
                hotel_id: 'test_hotel_001',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 2,
                children: 0,
                total_price: 299.99,
                currency: 'SGD',
                first_name: 'John',
                last_name: 'Traveler',
                email: 'test.booking.create@example.com',
                phone: '+65 9123 4567'
            };

            const booking = await BookingModel.create(bookingData);

            expect(booking).toBeDefined();
            expect(booking.id).toBeDefined();
            expect(booking.hotel_id).toBe(bookingData.hotel_id);
            expect(booking.total_price).toBe(bookingData.total_price);
            expect(booking.booking_status).toBe('confirmed');
        });

        test('should generate unique booking IDs', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const bookingData = {
                hotel_id: 'test_hotel_002',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 1,
                total_price: 199.99,
                first_name: 'Jane',
                last_name: 'Doe',
                email: 'test.booking.unique1@example.com'
            };

            const booking1 = await BookingModel.create(bookingData);
            const booking2 = await BookingModel.create({
                ...bookingData,
                email: 'test.booking.unique2@example.com'
            });

            expect(booking1.id).not.toBe(booking2.id);
            expect(booking1.id).toMatch(/^[0-9a-f-]{36}$/i); // UUID format
            expect(booking2.id).toMatch(/^[0-9a-f-]{36}$/i);
        });

        test('should store complex data as JSON', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 5);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 8);

            const roomTypes = [
                { type: 'deluxe', count: 1, price: 150 },
                { type: 'standard', count: 1, price: 100 }
            ];
            
            const billingAddress = {
                street: '123 Test Street',
                city: 'Singapore',
                postalCode: '123456',
                country: 'Singapore'
            };

            const bookingData = {
                hotel_id: 'test_hotel_003',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 2,
                total_price: 750.00,
                first_name: 'Complex',
                last_name: 'Data',
                email: 'test.booking.complex@example.com',
                room_types: roomTypes,
                billing_address: billingAddress,
                special_requests: 'Late check-in please'
            };

            const booking = await BookingModel.create(bookingData);
            expect(booking.id).toBeDefined();

            // Verify data is stored correctly in database
            const storedBooking = await BookingModel.findById(booking.id);
            expect(storedBooking.message_to_hotel).toBe('Late check-in please');
            
            // MySQL automatically parses JSON columns back to objects
            expect(typeof storedBooking.room_types).toBe('object');
            expect(typeof storedBooking.billing_address).toBe('object');
            
            // Verify the JSON data structure is correct
            expect(storedBooking.room_types).toEqual(roomTypes);
            expect(storedBooking.billing_address.street).toBe('123 Test Street');
        });
    });

    describe('Booking Validation', () => {
        test('should validate required fields', () => {
            const incompleteData = {
                hotel_id: 'test_hotel_004',
                // missing required fields
            };

            const errors = BookingModel.validateBookingData(incompleteData);
            
            expect(errors).toContain('Check-in date is required');
            expect(errors).toContain('Check-out date is required');
            expect(errors).toContain('First name is required');
            expect(errors).toContain('Last name is required');
            expect(errors).toContain('Email is required');
            expect(errors).toContain('Valid total price is required');
        });

        test('should validate date logic - check-in before check-out', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 5);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() + 3); // Earlier than tomorrow

            const invalidData = {
                hotel_id: 'test_hotel_005',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: yesterday.toISOString().split('T')[0], // Before start_date
                first_name: 'Test',
                last_name: 'User',
                email: 'test@example.com',
                total_price: 100
            };

            const errors = BookingModel.validateBookingData(invalidData);
            expect(errors).toContain('Check-out date must be after check-in date');
        });

        test('should validate date logic - no past dates', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const today = new Date();

            const pastData = {
                hotel_id: 'test_hotel_006',
                start_date: yesterday.toISOString().split('T')[0],
                end_date: today.toISOString().split('T')[0],
                first_name: 'Past',
                last_name: 'Booking',
                email: 'past@example.com',
                total_price: 100
            };

            const errors = BookingModel.validateBookingData(pastData);
            expect(errors).toContain('Check-in date cannot be in the past');
        });

        test('should validate email format', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const invalidEmailData = {
                hotel_id: 'test_hotel_007',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                first_name: 'Invalid',
                last_name: 'Email',
                email: 'not-an-email',
                total_price: 100
            };

            const errors = BookingModel.validateBookingData(invalidEmailData);
            expect(errors).toContain('Invalid email format');
        });

        test('should validate price constraints', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const negativePrice = {
                hotel_id: 'test_hotel_008',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                first_name: 'Negative',
                last_name: 'Price',
                email: 'negative@example.com',
                total_price: -50
            };

            const errors = BookingModel.validateBookingData(negativePrice);
            expect(errors).toContain('Total price must be greater than 0');
        });

        test('should validate guest count limits', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const tooManyGuests = {
                hotel_id: 'test_hotel_009',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                adults: 15, // Too many
                children: -1, // Invalid
                first_name: 'Too',
                last_name: 'Many',
                email: 'toomany@example.com',
                total_price: 100
            };

            const errors = BookingModel.validateBookingData(tooManyGuests);
            expect(errors).toContain('Adults count must be between 1 and 10');
            expect(errors).toContain('Children count must be between 0 and 10');
        });
    });

    describe('Booking Retrieval and Updates', () => {
        let testBookingId;

        beforeEach(async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const booking = await BookingModel.create({
                hotel_id: 'test_hotel_010',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 2,
                total_price: 399.99,
                first_name: 'Retrieval',
                last_name: 'Test',
                email: 'test.booking.retrieval@example.com'
            });
            testBookingId = booking.id;
        });

        test('should find booking by ID', async () => {
            const booking = await BookingModel.findById(testBookingId);
            
            expect(booking).toBeDefined();
            expect(booking.id).toBe(testBookingId);
            expect(booking.hotel_id).toBe('test_hotel_010');
            expect(booking.email).toBe('test.booking.retrieval@example.com');
        });

        test('should find bookings by user email', async () => {
            const bookings = await BookingModel.findByUserEmail('test.booking.retrieval@example.com');
            
            expect(bookings).toHaveLength(1);
            expect(bookings[0].id).toBe(testBookingId);
        });

        test('should update booking status', async () => {
            const success = await BookingModel.updateStatus(testBookingId, 'cancelled');
            expect(success).toBe(true);

            const updatedBooking = await BookingModel.findById(testBookingId);
            expect(updatedBooking.booking_status).toBe('cancelled');
        });

        test('should update booking status with payment reference', async () => {
            const paymentRef = 'stripe_pi_1234567890';
            const success = await BookingModel.updateStatus(testBookingId, 'completed', paymentRef);
            expect(success).toBe(true);

            const updatedBooking = await BookingModel.findById(testBookingId);
            expect(updatedBooking.booking_status).toBe('completed');
            expect(updatedBooking.payment_reference).toBe(paymentRef);
        });
    });

    describe('Payment Security', () => {
        test('should handle masked credit card storage', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const bookingData = {
                hotel_id: 'test_hotel_security',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 3,
                adults: 1,
                total_price: 199.99,
                first_name: 'Security',
                last_name: 'Test',
                email: 'test.booking.security@example.com',
                masked_card_number: '123456******7890', // Only first 6 and last 4
                payment_reference: 'stripe_pi_secure123'
            };

            const booking = await BookingModel.create(bookingData);
            expect(booking.id).toBeDefined();

            const storedBooking = await BookingModel.findById(booking.id);
            expect(storedBooking.masked_card_number).toBe('123456******7890');
            expect(storedBooking.payment_reference).toBe('stripe_pi_secure123');
        });

        test('should not store full credit card numbers', async () => {
            // This test ensures we never accidentally store full card numbers
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 4);
            const dayAfter = new Date();
            dayAfter.setDate(dayAfter.getDate() + 7);

            const bookingData = {
                hotel_id: 'test_hotel_card_security',
                start_date: tomorrow.toISOString().split('T')[0],
                end_date: dayAfter.toISOString().split('T')[0],
                nights: 2,
                adults: 1,
                total_price: 150.00,
                first_name: 'Card',
                last_name: 'Security',
                email: 'test.booking.card.security@example.com',
                masked_card_number: '424242******4242' // Properly masked
            };

            const booking = await BookingModel.create(bookingData);
            const storedBooking = await BookingModel.findById(booking.id);
            
            // Ensure no full card number patterns exist
            expect(storedBooking.masked_card_number).not.toMatch(/^\d{16}$/);
            expect(storedBooking.masked_card_number).toContain('*');
        });
    });
});
