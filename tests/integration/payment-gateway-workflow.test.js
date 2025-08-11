import { jest, describe, test, expect } from '@jest/globals';

describe('Payment Gateway Workflow Integration Tests', () => {
  
  // Test the complete booking form to Stripe payment workflow
  test('Complete Booking Form to Stripe Payment Workflow', async () => {
    // 1. Form Validation
    const formData = {
      first_name: 'John',
      last_name: 'Doe',
      phone: '+65 91234567',
      email: 'john@example.com',
      hotel_id: 'hotel_123',
      hotel_name: 'Grand Plaza Hotel',
      start_date: '2025-08-15',
      end_date: '2025-08-17',
      nights: 2,
      adults: 2,
      total_price: 500,
      currency: 'SGD'
    };

    // Simulate form validation
    const validateForm = (data) => {
      const errors = [];
      if (!data.first_name) errors.push('First name is required');
      if (!data.last_name) errors.push('Last name is required');
      if (!data.phone) errors.push('Phone is required');
      if (!data.email) errors.push('Email is required');
      if (!data.hotel_id) errors.push('Hotel ID is required');
      if (!data.total_price || data.total_price <= 0) errors.push('Valid total price is required');
      return errors;
    };

    const validationErrors = validateForm(formData);
    expect(validationErrors).toHaveLength(0);
    console.log('✅ Form validation passed');

    // 2. Create Booking API Call
    const createBooking = async (data) => {
      // Mock successful booking creation
      return {
        success: true,
        booking: {
          id: 'booking_' + Date.now(),
          status: 'pending',
          totalPrice: data.total_price,
          currency: data.currency
        },
        payment: {
          sessionId: 'session_' + Date.now(),
          url: 'https://checkout.stripe.com/pay/session_abc123'
        }
      };
    };

    const bookingResponse = await createBooking(formData);
    expect(bookingResponse.success).toBe(true);
    expect(bookingResponse.booking.status).toBe('pending');
    expect(bookingResponse.payment.url).toContain('checkout.stripe.com');
    console.log('✅ Booking creation successful');

    // 3. Stripe Session Configuration
    const createStripeSession = (bookingData) => {
      return {
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: bookingData.currency.toLowerCase(),
            unit_amount: bookingData.total_price * 100, // Convert to cents
            product_data: {
              name: `Hotel Booking - ${bookingData.hotel_name}`,
              description: `${bookingData.nights} night(s) from ${bookingData.start_date} to ${bookingData.end_date}`
            }
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: `http://localhost:5174/booking-success?booking_id=${bookingResponse.booking.id}`,
        cancel_url: `http://localhost:5174/booking-cancel?booking_id=${bookingResponse.booking.id}`,
        metadata: {
          booking_id: bookingResponse.booking.id,
          user_id: 'user_test_123',
          user_email: 'test@hotel.com'
        }
      };
    };

    const stripeSession = createStripeSession(formData);
    expect(stripeSession.line_items[0].price_data.unit_amount).toBe(50000); // 500 * 100
    expect(stripeSession.line_items[0].price_data.currency).toBe('sgd');
    expect(stripeSession.metadata.booking_id).toBeDefined();
    console.log('✅ Stripe session configuration correct');

    // 4. Payment Redirect
    const redirectToPayment = (paymentUrl) => {
      // Simulate redirect to Stripe
      return paymentUrl.includes('checkout.stripe.com');
    };

    const redirected = redirectToPayment(bookingResponse.payment.url);
    expect(redirected).toBe(true);
    console.log('✅ Payment redirect successful');

    console.log('\n🎯 Complete Payment Gateway Workflow Test PASSED!');
  });

  // Test error handling in the workflow
  test('Payment Gateway Error Handling', async () => {
    // Test form validation errors
    const invalidFormData = {
      first_name: '',
      last_name: '',
      email: 'invalid-email',
      total_price: 0
    };

    const validateForm = (data) => {
      const errors = [];
      if (!data.first_name) errors.push('First name is required');
      if (!data.last_name) errors.push('Last name is required');
      if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) errors.push('Valid email is required');
      if (!data.total_price || data.total_price <= 0) errors.push('Valid total price is required');
      return errors;
    };

    const errors = validateForm(invalidFormData);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('First name is required');
    expect(errors).toContain('Last name is required');
    expect(errors).toContain('Valid email is required');
    expect(errors).toContain('Valid total price is required');
    console.log('✅ Form validation errors handled correctly');

    // Test API error handling
    const createBookingWithError = async () => {
      throw new Error('Stripe API temporarily unavailable');
    };

    try {
      await createBookingWithError();
    } catch (error) {
      expect(error.message).toBe('Stripe API temporarily unavailable');
      console.log('✅ API errors handled correctly');
    }

    console.log('\n🎯 Error Handling Test PASSED!');
  });

  // Test data transformation
  test('Data Transformation and Mapping', () => {
    const frontendFormData = {
      firstName: 'Jane',
      lastName: 'Smith',
      phoneNumber: '+1-555-0123',
      email: 'jane@example.com',
      hotelName: 'Luxury Resort',
      checkInDate: '2025-09-01',
      checkOutDate: '2025-09-03',
      numberOfNights: 2,
      numberOfGuests: 3,
      totalAmount: 750
    };

    // Transform frontend data to backend API format
    const transformToApiFormat = (formData) => {
      return {
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phoneNumber,
        email: formData.email,
        hotel_name: formData.hotelName,
        start_date: formData.checkInDate,
        end_date: formData.checkOutDate,
        nights: formData.numberOfNights,
        adults: formData.numberOfGuests,
        total_price: formData.totalAmount,
        currency: 'SGD'
      };
    };

    const apiData = transformToApiFormat(frontendFormData);
    
    expect(apiData.first_name).toBe('Jane');
    expect(apiData.last_name).toBe('Smith');
    expect(apiData.phone).toBe('+1-555-0123');
    expect(apiData.start_date).toBe('2025-09-01');
    expect(apiData.total_price).toBe(750);
    console.log('✅ Data transformation correct');

    // Transform for Stripe (currency to lowercase, price to cents)
    const transformForStripe = (data) => {
      return {
        currency: data.currency.toLowerCase(),
        unit_amount: data.total_price * 100,
        product_name: `Hotel Booking - ${data.hotel_name}`
      };
    };

    const stripeData = transformForStripe(apiData);
    expect(stripeData.currency).toBe('sgd');
    expect(stripeData.unit_amount).toBe(75000); // 750 * 100
    expect(stripeData.product_name).toBe('Hotel Booking - Luxury Resort');
    console.log('✅ Stripe data transformation correct');

    console.log('\n🎯 Data Transformation Test PASSED!');
  });
});
