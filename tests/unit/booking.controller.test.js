import { jest, describe, test, beforeEach, expect, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bookingRouter from '../../controller/bookingController.js';

// Mock the booking model
jest.mock('../../model/booking.js', () => ({
    default: {
        validateBookingData: jest.fn(() => []),
        create: jest.fn(() => Promise.resolve({ id: 'test-booking-123' }))
    }
}));

// Mock the database config
jest.mock('../../config/database.js', () => ({
    default: {
        getConnection: jest.fn(() => Promise.resolve({
            execute: jest.fn(),
            release: jest.fn()
        }))
    }
}));

// Mock config
jest.mock('../../config/config.js', () => ({
    default: {
        JWTKey: 'test-secret-key'
    }
}));

describe('Booking Controller Tests', () => {
    let app;
    const testJwtSecret = 'test-secret-key';

    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Mock authentication middleware
        app.use('/api/bookings', (req, res, next) => {
            // Mock authenticated user
            res.locals.userId = 'test-user-123';
            res.locals.email = 'test@example.com';
            next();
        });
        
        app.use('/api/bookings', bookingRouter);
        
        jest.clearAllMocks();
    });

    describe('POST /api/bookings', () => {
        test('should handle HotelDetails.jsx data structure', async () => {
            // This is the exact data structure from your HotelDetails.jsx mock
            const hotelDetailsData = {
                name: "ibis budget Singapore Selegie",
                room: "Superior Room, 2 Twin Beds",
                checkIn: "2025-08-29",
                checkOut: "2025-08-31",
                guests: 2,
                nights: 2,
                price: 321.22,
            };

            const response = await request(app)
                .post('/api/bookings')
                .send(hotelDetailsData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.booking).toBeDefined();
        });

        test('should handle BookingForm.jsx data structure', async () => {
            // This is the data structure from BookingForm.jsx
            const bookingFormData = {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                phoneNumber: '+1234567890',
                hotelName: 'Grand Plaza Hotel',
                roomType: 'Deluxe Suite',
                checkInDate: '2025-08-29',
                checkOutDate: '2025-08-31',
                numberOfGuests: 2,
                numberOfNights: 2,
                pricePerNight: 250,
                totalAmount: 500,
                bookingId: 'booking_test_123'
            };

            const response = await request(app)
                .post('/api/bookings')
                .send(bookingFormData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.booking).toBeDefined();
        });

        test('should map field names correctly for validation', async () => {
            const { default: BookingModel } = await import('../../model/booking.js');
            
            const testData = {
                name: "Test Hotel",
                room: "Test Room",
                checkIn: "2025-08-29",
                checkOut: "2025-08-31",
                guests: 2,
                price: 100
            };

            await request(app)
                .post('/api/bookings')
                .send(testData);

            // Check that the validation was called with correctly mapped data
            expect(BookingModel.validateBookingData).toHaveBeenCalledWith(
                expect.objectContaining({
                    hotel_name: "Test Hotel",
                    room_type: "Test Room", 
                    start_date: "2025-08-29",
                    end_date: "2025-08-31",
                    adults: 2,
                    total_price: 100,
                    first_name: 'Guest',
                    last_name: 'User',
                    email: 'test@example.com'
                })
            );
        });
    });
});
