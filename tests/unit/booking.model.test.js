import BookingModel from '../../model/booking.js';
import { pool } from '../../config/database.js';
import { jest } from '@jest/globals';

// Mock database pool
jest.mock('../../config/database.js', () => ({
    pool: {
        execute: jest.fn()
    }
}));

// Mock UUID
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mock-uuid-123')
}));

describe('Database Model Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test 29: Booking Model Creates with UUID
    test('Booking Model Creates with UUID', async () => {
        const mockBookingData = {
            hotel_id: 'hotel_123',
            start_date: '2025-08-15',
            end_date: '2025-08-17',
            nights: 2,
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            total_price: 500
        };

        pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

        const result = await BookingModel.create(mockBookingData);

        expect(result.id).toBe('mock-uuid-123');
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO bookings'),
            expect.arrayContaining(['mock-uuid-123'])
        );
    });

    // Test 30: Booking Model Validates Email Format
    test('Booking Model Validates Email Format', () => {
        const validEmails = [
            'test@example.com',
            'user@domain.org',
            'user.name@company.co.uk'
        ];

        const invalidEmails = [
            'invalid-email',
            'test@',
            '@domain.com',
            'test.email',
            ''
        ];

        validEmails.forEach(email => {
            const errors = BookingModel.validateBookingData({
                hotel_id: 'hotel_123',
                start_date: '2025-08-15',
                end_date: '2025-08-17',
                first_name: 'John',
                last_name: 'Doe',
                email: email,
                total_price: 100
            });

            const emailErrors = errors.filter(error => error.includes('email'));
            expect(emailErrors).toHaveLength(0);
        });

        invalidEmails.forEach(email => {
            const errors = BookingModel.validateBookingData({
                hotel_id: 'hotel_123',
                start_date: '2025-08-15',
                end_date: '2025-08-17',
                first_name: 'John',
                last_name: 'Doe',
                email: email,
                total_price: 100
            });

            if (email === '') {
                expect(errors).toContain('Email is required');
            } else {
                expect(errors).toContain('Invalid email format');
            }
        });
    });

    // Test 31: Booking Model Handles JSON Fields
    test('Booking Model Handles JSON Fields', async () => {
        const mockBookingData = {
            hotel_id: 'hotel_123',
            start_date: '2025-08-15',
            end_date: '2025-08-17',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            total_price: 500,
            room_types: ['Deluxe', 'Suite'],
            billing_address: {
                street: '123 Main St',
                city: 'Singapore',
                postal_code: '123456'
            }
        };

        pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

        await BookingModel.create(mockBookingData);

        const callArgs = pool.execute.mock.calls[0];
        const parameters = callArgs[1];
        
        // Check that room_types and billing_address are JSON stringified
        expect(parameters).toContain(JSON.stringify(['Deluxe', 'Suite']));
        expect(parameters).toContain(JSON.stringify({
            street: '123 Main St',
            city: 'Singapore',
            postal_code: '123456'
        }));
    });

    // Test 32: Booking Model Updates Status
    test('Booking Model Updates Status', async () => {
        const bookingId = 'booking_123';
        const newStatus = 'confirmed';
        const paymentRef = 'payment_456';

        pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

        const result = await BookingModel.updateStatus(bookingId, newStatus, paymentRef);

        expect(result).toBe(true);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE bookings SET booking_status = ?'),
            [newStatus, paymentRef, bookingId]
        );
    });

    // Test 33: Booking Model Finds by User Email
    test('Booking Model Finds by User Email', async () => {
        const userEmail = 'test@hotel.com';
        const mockBookings = [
            { id: 'booking_1', email: userEmail, hotel_name: 'Hotel A' },
            { id: 'booking_2', email: userEmail, hotel_name: 'Hotel B' }
        ];

        pool.execute.mockResolvedValue([mockBookings]);

        const result = await BookingModel.findByUserEmail(userEmail);

        expect(result).toEqual(mockBookings);
        expect(pool.execute).toHaveBeenCalledWith(
            'SELECT * FROM bookings WHERE email = ? ORDER BY created_at DESC',
            [userEmail]
        );
    });

    // Test for date validation
    test('Booking Model Validates Date Logic', () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        // Test past date
        const pastDateErrors = BookingModel.validateBookingData({
            hotel_id: 'hotel_123',
            start_date: yesterday.toISOString().split('T')[0],
            end_date: tomorrow.toISOString().split('T')[0],
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            total_price: 100
        });

        expect(pastDateErrors).toContain('Check-in date cannot be in the past');

        // Test end date before start date
        const invalidDateRangeErrors = BookingModel.validateBookingData({
            hotel_id: 'hotel_123',
            start_date: tomorrow.toISOString().split('T')[0],
            end_date: today.toISOString().split('T')[0],
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            total_price: 100
        });

        expect(invalidDateRangeErrors).toContain('Check-out date must be after check-in date');
    });

    // Test required fields validation
    test('Booking Model Validates Required Fields', () => {
        const requiredFieldTests = [
            { field: 'hotel_id', value: '', error: 'Hotel ID is required' },
            { field: 'start_date', value: '', error: 'Check-in date is required' },
            { field: 'end_date', value: '', error: 'Check-out date is required' },
            { field: 'first_name', value: '', error: 'First name is required' },
            { field: 'last_name', value: '', error: 'Last name is required' },
            { field: 'email', value: '', error: 'Email is required' },
            { field: 'total_price', value: 0, error: 'Valid total price is required' }
        ];

        requiredFieldTests.forEach(({ field, value, error }) => {
            const testData = {
                hotel_id: 'hotel_123',
                start_date: '2025-08-15',
                end_date: '2025-08-17',
                first_name: 'John',
                last_name: 'Doe',
                email: 'john@example.com',
                total_price: 100,
                [field]: value
            };

            const errors = BookingModel.validateBookingData(testData);
            expect(errors).toContain(error);
        });
    });
});
