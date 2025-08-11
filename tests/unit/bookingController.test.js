import request from 'supertest';
import express from 'express';
import bookingController from '../../controller/bookingController.js';
import { verifyToken } from '../../middleware/auth.js';
import BookingModel from '../../model/booking.js';
import stripe from '../../config/stripe.js';

// Mock dependencies
jest.mock('../../middleware/auth.js');
jest.mock('../../model/booking.js');
jest.mock('../../config/stripe.js');

const app = express();
app.use(express.json());
app.use('/bookings', bookingController.router);

describe('Booking Form to Stripe Payment Gateway Tests', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockUserEmail = 'test@hotel.com';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth middleware
    verifyToken.mockImplementation((req, res, next) => {
      res.locals.userId = mockUserId;
      res.locals.email = mockUserEmail;
      next();
    });
  });

  // Test 1: Controller Validates Booking Form Data
  test('Controller Validates Booking Form Data Before Payment Gateway', async () => {
    BookingModel.validateBookingData.mockReturnValue([
      'Hotel ID is required',
      'Check-in date is required',
      'First name is required',
      'Email is required',
      'Valid total price is required'
    ]);
    
    const response = await request(app)
      .post('/bookings')
      .send({
        hotel_id: '',
        start_date: '',
        first_name: '',
        email: '',
        total_price: 0
      });
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.errors).toEqual([
      'Hotel ID is required',
      'Check-in date is required',
      'First name is required',
      'Email is required',
      'Valid total price is required'
    ]);
  });

  // Test 2: Successful Booking Creation and Stripe Session
  test('Successful Booking Creation Creates Stripe Payment Session', async () => {
    const mockBooking = {
      id: 'booking_123',
      hotel_id: 'hotel_456',
      total_price: 500,
      currency: 'SGD',
      booking_status: 'pending'
    };
    
    const mockStripeSession = {
      id: 'session_abc123',
      url: 'https://checkout.stripe.com/pay/session_abc123',
      payment_intent: 'pi_test_123'
    };
    
    BookingModel.validateBookingData.mockReturnValue([]);
    BookingModel.create.mockResolvedValue(mockBooking);
    stripe.checkout.sessions.create.mockResolvedValue(mockStripeSession);
    
    const response = await request(app)
      .post('/bookings')
      .send({
        hotel_id: 'hotel_456',
        hotel_name: 'Grand Plaza Hotel',
        start_date: '2025-08-15',
        end_date: '2025-08-17',
        nights: 2,
        adults: 2,
        first_name: 'John',
        last_name: 'Doe',
        phone: '+65 91234567',
        total_price: 500,
        currency: 'SGD',
        room_types: ['Deluxe Suite']
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Booking created, redirecting to payment');
    expect(response.body.booking).toMatchObject({
      id: 'booking_123',
      status: 'pending',
      totalPrice: 500,
      currency: 'SGD'
    });
    expect(response.body.payment).toMatchObject({
      sessionId: 'session_abc123',
      url: 'https://checkout.stripe.com/pay/session_abc123'
    });
  });

  // Test 3: Stripe Session Created with Correct Parameters
  test('Stripe Session Created with Correct Payment Parameters', async () => {
    const mockBooking = { id: 'booking_123', total_price: 750 };
    
    BookingModel.validateBookingData.mockReturnValue([]);
    BookingModel.create.mockResolvedValue(mockBooking);
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'session_123',
      url: 'https://stripe.com'
    });
    
    await request(app)
      .post('/bookings')
      .send({
        hotel_id: 'hotel_789',
        hotel_name: 'Luxury Resort',
        start_date: '2025-08-20',
        end_date: '2025-08-22',
        nights: 2,
        first_name: 'Jane',
        last_name: 'Smith',
        total_price: 750,
        currency: 'SGD'
      });
    
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'sgd',
            product_data: {
              name: 'Hotel Booking - Luxury Resort',
              description: '2 night(s) from 2025-08-20 to 2025-08-22'
            },
            unit_amount: 75000 // 750 * 100 cents
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: expect.stringContaining('/booking-success'),
        cancel_url: expect.stringContaining('/booking-cancel'),
        metadata: {
          booking_id: 'booking_123',
          user_id: mockUserId,
          user_email: mockUserEmail
        }
      })
    );
  });

  // Test 4: Stripe Payment Gateway Error Handling
  test('Stripe Payment Gateway Error Handling Preserves Booking', async () => {
    const mockBooking = { id: 'booking_456', total_price: 300 };
    
    BookingModel.validateBookingData.mockReturnValue([]);
    BookingModel.create.mockResolvedValue(mockBooking);
    BookingModel.updateStatus.mockResolvedValue(true);
    
    // Mock Stripe error
    stripe.checkout.sessions.create.mockRejectedValue(
      new Error('Stripe API temporarily unavailable')
    );
    
    const response = await request(app)
      .post('/bookings')
      .send({
        hotel_id: 'hotel_999',
        start_date: '2025-08-25',
        end_date: '2025-08-27',
        first_name: 'Bob',
        last_name: 'Wilson',
        total_price: 300
      });
    
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Booking created but payment processing failed');
    expect(response.body.error).toBe('Payment gateway error');
    expect(response.body.booking.id).toBe('booking_456');
    expect(response.body.backupId).toBe('booking_456');
    
    // Should update booking status with error reference
    expect(BookingModel.updateStatus).toHaveBeenCalledWith(
      'booking_456',
      'pending',
      expect.stringContaining('PAYMENT_ERROR_')
    );
  });

  // Test 5: Booking Form Data Mapping to Database
  test('Booking Form Data Correctly Mapped to Database Model', async () => {
    const mockBooking = { id: 'booking_789' };
    
    BookingModel.validateBookingData.mockReturnValue([]);
    BookingModel.create.mockResolvedValue(mockBooking);
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'session_123',
      url: 'https://stripe.com'
    });
    
    await request(app)
      .post('/bookings')
      .send({
        hotel_id: 'hotel_special',
        hotel_name: 'Boutique Hotel',
        start_date: '2025-09-01',
        end_date: '2025-09-03',
        nights: 2,
        adults: 3,
        children: 1,
        first_name: 'Alice',
        last_name: 'Johnson',
        phone: '+1-555-0123',
        total_price: 850,
        currency: 'USD',
        message_to_hotel: 'Late check-in requested',
        room_types: ['Family Suite', 'Connecting Room']
      });
    
    expect(BookingModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        hotel_id: 'hotel_special',
        hotel_name: 'Boutique Hotel',
        start_date: '2025-09-01',
        end_date: '2025-09-03',
        nights: 2,
        adults: 3,
        children: 1,
        first_name: 'Alice',
        last_name: 'Johnson',
        phone: '+1-555-0123',
        email: mockUserEmail, // Should use authenticated user's email
        total_price: 850,
        currency: 'USD',
        message_to_hotel: 'Late check-in requested',
        room_types: ['Family Suite', 'Connecting Room']
      })
    );
  });

  // Test 6: Payment Gateway Success URLs Configuration
  test('Payment Gateway Success URLs Include Booking ID', async () => {
    const mockBooking = { id: 'booking_url_test' };
    
    BookingModel.validateBookingData.mockReturnValue([]);
    BookingModel.create.mockResolvedValue(mockBooking);
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'session_url_test',
      url: 'https://stripe.com'
    });
    
    await request(app)
      .post('/bookings')
      .send({
        hotel_id: 'hotel_123',
        start_date: '2025-08-15',
        end_date: '2025-08-17',
        first_name: 'Test',
        last_name: 'User',
        total_price: 100
      });
    
    const stripeCall = stripe.checkout.sessions.create.mock.calls[0][0];
    
    expect(stripeCall.success_url).toContain('booking_url_test');
    expect(stripeCall.success_url).toContain('/booking-success');
    expect(stripeCall.success_url).toMatch(/session_id=\{CHECKOUT_SESSION_ID\}/);
    
    expect(stripeCall.cancel_url).toContain('booking_url_test');
    expect(stripeCall.cancel_url).toContain('/booking-cancel');
  });

  // Test 7: No Stripe Configuration Fallback
  test('No Stripe Configuration Falls Back to Test Mode', async () => {
    const mockBooking = { id: 'booking_no_stripe', total_price: 200 };
    
    BookingModel.validateBookingData.mockReturnValue([]);
    BookingModel.create.mockResolvedValue(mockBooking);
    BookingModel.updateStatus.mockResolvedValue(true);
    
    // Mock no Stripe configuration
    stripe.mockImplementation(() => null);
    
    const response = await request(app)
      .post('/bookings')
      .send({
        hotel_id: 'hotel_test',
        start_date: '2025-08-15',
        end_date: '2025-08-17',
        first_name: 'Test',
        last_name: 'NoStripe',
        total_price: 200
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Booking created successfully (test mode)');
    expect(response.body.booking.testMode).toBe(true);
    expect(response.body.booking.status).toBe('confirmed');
    
    // Should update booking status to confirmed
    expect(BookingModel.updateStatus).toHaveBeenCalledWith(
      'booking_no_stripe',
      'confirmed',
      'TEST_PAYMENT'
    );
  });

  // Test 8: Currency Conversion for Stripe
  test('Currency Converted to Lowercase for Stripe API', async () => {
    const mockBooking = { id: 'booking_currency' };
    
    BookingModel.validateBookingData.mockReturnValue([]);
    BookingModel.create.mockResolvedValue(mockBooking);
    stripe.checkout.sessions.create.mockResolvedValue({
      id: 'session_currency',
      url: 'https://stripe.com'
    });
    
    await request(app)
      .post('/bookings')
      .send({
        hotel_id: 'hotel_123',
        start_date: '2025-08-15',
        end_date: '2025-08-17',
        first_name: 'Currency',
        last_name: 'Test',
        total_price: 1000,
        currency: 'USD' // Uppercase currency
      });
    
    const stripeCall = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(stripeCall.line_items[0].price_data.currency).toBe('usd'); // Should be lowercase
  });
});
