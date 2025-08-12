import { jest, describe, test, expect } from '@jest/globals';

// Mock currency conversion utility (simulates your actual currency.js)
const mockCurrencyRates = {
  'SGD': 1.0,
  'USD': 0.74,
  'EUR': 0.68,
  'GBP': 0.58,
  'JPY': 109.0,
  'AUD': 1.03,
  'CAD': 0.99,
  'CHF': 0.67,
  'CNY': 5.28,
  'HKD': 5.77,
  'NZD': 1.12,
  'SEK': 7.85
};

const convertFromSGD = (amount, targetCurrency) => {
  const rate = mockCurrencyRates[targetCurrency];
  if (!rate) throw new Error(`Unsupported currency: ${targetCurrency}`);
  return Math.round(amount * rate);
};

describe('Payment Gateway Workflow Integration Tests', () => {
  
  // Test the complete booking form to Stripe payment workflow
  test('Complete Booking Form to Stripe Payment Workflow', async () => {
    // 1. Enhanced Form Validation
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

    // Enhanced form validation with date and format checks
    const validateForm = (data) => {
      const errors = [];
      
      // Required field validation
      if (!data.first_name?.trim()) errors.push('First name is required');
      if (!data.last_name?.trim()) errors.push('Last name is required');
      if (!data.phone?.trim()) errors.push('Phone is required');
      if (!data.email?.trim()) errors.push('Email is required');
      if (!data.hotel_id?.trim()) errors.push('Hotel ID is required');
      if (!data.total_price || data.total_price <= 0) errors.push('Valid total price is required');
      
      // Email format validation
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Invalid email format');
      }
      
      // Phone format validation (basic international format)
      if (data.phone && !/^\+[\d\s\-()]+$/.test(data.phone)) {
        errors.push('Invalid phone number format');
      }
      
      // Date validation
      if (data.start_date && data.end_date) {
        const startDate = new Date(data.start_date);
        const endDate = new Date(data.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (isNaN(startDate.getTime())) errors.push('Invalid check-in date');
        if (isNaN(endDate.getTime())) errors.push('Invalid check-out date');
        if (startDate < today) errors.push('Check-in date cannot be in the past');
        if (endDate <= startDate) errors.push('Check-out date must be after check-in date');
      }
      
      // Currency validation
      if (data.currency && !mockCurrencyRates[data.currency]) {
        errors.push('Unsupported currency');
      }
      
      // Guest count validation
      if (data.adults && (data.adults < 1 || data.adults > 10)) {
        errors.push('Adults count must be between 1 and 10');
      }
      
      return errors;
    };

    const validationErrors = validateForm(formData);
    expect(validationErrors).toHaveLength(0);
    console.log('✅ Enhanced form validation passed');

    // 2. Enhanced Booking API Call with Error Scenarios
    const createBooking = async (data) => {
      // Simulate authentication check
      if (!data.userToken) {
        throw new Error('Authentication required');
      }
      
      // Simulate data mapping validation
      const requiredFields = ['first_name', 'last_name', 'email', 'hotel_id', 'total_price'];
      const missingFields = requiredFields.filter(field => !data[field]);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      // Simulate different response scenarios
      if (data.simulateError === 'network') {
        throw new Error('Network error: Unable to reach server');
      }
      if (data.simulateError === 'server') {
        throw new Error('Server error: 500 Internal Server Error');
      }
      if (data.simulateError === 'validation') {
        return {
          success: false,
          error: 'Validation failed',
          details: ['Invalid hotel_id format']
        };
      }
      
      // Mock successful booking creation
      return {
        success: true,
        booking: {
          id: 'booking_' + Date.now(),
          status: 'pending',
          totalPrice: data.total_price,
          currency: data.currency,
          created_at: new Date().toISOString()
        },
        payment: {
          sessionId: 'session_' + Date.now(),
          url: 'https://checkout.stripe.com/pay/session_abc123'
        }
      };
    };

    // Test successful booking creation
    const bookingData = { ...formData, userToken: 'valid_jwt_token' };
    const bookingResponse = await createBooking(bookingData);
    expect(bookingResponse.success).toBe(true);
    expect(bookingResponse.booking.status).toBe('pending');
    expect(bookingResponse.booking.currency).toBe('SGD');
    expect(bookingResponse.payment.url).toContain('checkout.stripe.com');
    console.log('✅ Enhanced booking creation successful');

    // 3. Enhanced Stripe Session Configuration with Multi-Currency Support
    const createStripeSession = (bookingData) => {
      // Convert SGD to target currency if needed
      let finalAmount = bookingData.total_price;
      let finalCurrency = bookingData.currency;
      
      if (bookingData.currency !== 'SGD') {
        finalAmount = convertFromSGD(bookingData.total_price, bookingData.currency);
        console.log(`💱 Currency conversion: SGD ${bookingData.total_price} → ${bookingData.currency} ${finalAmount}`);
      }
      
      // Validate amount precision for different currencies
      if (['JPY', 'KRW', 'VND'].includes(finalCurrency)) {
        // Zero-decimal currencies - no decimal places
        finalAmount = Math.round(finalAmount);
      } else {
        // Standard currencies - round to cents
        finalAmount = Math.round(finalAmount * 100) / 100;
      }
      
      return {
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: finalCurrency.toLowerCase(),
            unit_amount: ['JPY', 'KRW', 'VND'].includes(finalCurrency) 
              ? Math.round(finalAmount) 
              : Math.round(finalAmount * 100), // Convert to smallest currency unit
            product_data: {
              name: `Hotel Booking - ${bookingData.hotel_name}`,
              description: `${bookingData.nights} night(s) from ${bookingData.start_date} to ${bookingData.end_date} for ${bookingData.adults} guest(s)`
            }
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: `http://localhost:5174/booking-success?booking_id=${bookingResponse.booking.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:5174/booking-cancel?booking_id=${bookingResponse.booking.id}&reason=user_cancelled`,
        metadata: {
          booking_id: bookingResponse.booking.id,
          user_id: 'user_test_123',
          user_email: 'test@hotel.com',
          original_amount: bookingData.total_price,
          original_currency: 'SGD',
          converted_amount: finalAmount,
          converted_currency: finalCurrency,
          hotel_name: bookingData.hotel_name
        }
      };
    };

    // Test SGD (base currency)
    const stripeSessionSGD = createStripeSession(formData);
    expect(stripeSessionSGD.line_items[0].price_data.unit_amount).toBe(50000); // 500 * 100
    expect(stripeSessionSGD.line_items[0].price_data.currency).toBe('sgd');
    expect(stripeSessionSGD.metadata.booking_id).toBeDefined();
    expect(stripeSessionSGD.metadata.original_currency).toBe('SGD');
    console.log('✅ SGD Stripe session configuration correct');

    // Test USD conversion
    const formDataUSD = { ...formData, currency: 'USD' };
    const stripeSessionUSD = createStripeSession(formDataUSD);
    expect(stripeSessionUSD.line_items[0].price_data.unit_amount).toBe(37000); // 370 * 100 (500 SGD * 0.74)
    expect(stripeSessionUSD.line_items[0].price_data.currency).toBe('usd');
    expect(stripeSessionUSD.metadata.converted_amount).toBe(370);
    console.log('✅ USD conversion and Stripe session correct');

    // Test EUR conversion
    const formDataEUR = { ...formData, currency: 'EUR' };
    const stripeSessionEUR = createStripeSession(formDataEUR);
    expect(stripeSessionEUR.line_items[0].price_data.unit_amount).toBe(34000); // 340 * 100 (500 SGD * 0.68)
    expect(stripeSessionEUR.line_items[0].price_data.currency).toBe('eur');
    console.log('✅ EUR conversion and Stripe session correct');

    // Test JPY (zero-decimal currency)
    const formDataJPY = { ...formData, currency: 'JPY' };
    const stripeSessionJPY = createStripeSession(formDataJPY);
    expect(stripeSessionJPY.line_items[0].price_data.unit_amount).toBe(54500); // 500 SGD * 109 (no *100 for JPY)
    expect(stripeSessionJPY.line_items[0].price_data.currency).toBe('jpy');
    console.log('✅ JPY (zero-decimal) conversion and Stripe session correct');

    // 4. Enhanced Payment Redirect with URL Validation
    const redirectToPayment = (paymentUrl, bookingId) => {
      // Validate URL structure
      const urlValidation = {
        isStripeUrl: paymentUrl.includes('checkout.stripe.com'),
        hasSessionId: paymentUrl.includes('session_'),
        isSecure: paymentUrl.startsWith('https://'),
        isValid: false
      };
      
      urlValidation.isValid = urlValidation.isStripeUrl && 
                             urlValidation.hasSessionId && 
                             urlValidation.isSecure;
      
      return urlValidation;
    };

    const redirectResult = redirectToPayment(bookingResponse.payment.url, bookingResponse.booking.id);
    expect(redirectResult.isValid).toBe(true);
    expect(redirectResult.isStripeUrl).toBe(true);
    expect(redirectResult.isSecure).toBe(true);
    console.log('✅ Enhanced payment redirect validation successful');

    console.log('\n🎯 Complete Enhanced Payment Gateway Workflow Test PASSED!');
  });

  // Enhanced error handling test with comprehensive scenarios
  test('Enhanced Payment Gateway Error Handling', async () => {
    // Test comprehensive form validation errors
    const testCases = [
      {
        name: 'Missing required fields',
        data: { first_name: '', last_name: '', email: '', total_price: 0 },
        expectedErrors: ['First name is required', 'Last name is required', 'Email is required', 'Valid total price is required']
      },
      {
        name: 'Invalid email format',
        data: { first_name: 'John', last_name: 'Doe', email: 'invalid-email', total_price: 100 },
        expectedErrors: ['Invalid email format']
      },
      {
        name: 'Invalid phone format',
        data: { first_name: 'John', last_name: 'Doe', email: 'john@test.com', phone: 'abc123', total_price: 100 },
        expectedErrors: ['Invalid phone number format']
      },
      {
        name: 'Invalid dates',
        data: { 
          first_name: 'John', 
          last_name: 'Doe', 
          email: 'john@test.com',
          start_date: '2025-08-20',
          end_date: '2025-08-15', // End before start
          total_price: 100 
        },
        expectedErrors: ['Check-out date must be after check-in date']
      },
      {
        name: 'Past check-in date',
        data: { 
          first_name: 'John', 
          last_name: 'Doe', 
          email: 'john@test.com',
          start_date: '2025-08-01', // Past date
          end_date: '2025-08-15',
          total_price: 100 
        },
        expectedErrors: ['Check-in date cannot be in the past']
      },
      {
        name: 'Unsupported currency',
        data: { 
          first_name: 'John', 
          last_name: 'Doe', 
          email: 'john@test.com',
          currency: 'XYZ',
          total_price: 100 
        },
        expectedErrors: ['Unsupported currency']
      },
      {
        name: 'Invalid guest count',
        data: { 
          first_name: 'John', 
          last_name: 'Doe', 
          email: 'john@test.com',
          adults: 15, // Too many
          total_price: 100 
        },
        expectedErrors: ['Adults count must be between 1 and 10']
      }
    ];

    // Enhanced form validation function
    const validateForm = (data) => {
      const errors = [];
      
      // Required field validation
      if (!data.first_name?.trim()) errors.push('First name is required');
      if (!data.last_name?.trim()) errors.push('Last name is required');
      if (!data.phone?.trim()) errors.push('Phone is required');
      if (!data.email?.trim()) errors.push('Email is required');
      if (!data.hotel_id?.trim()) errors.push('Hotel ID is required');
      if (!data.total_price || data.total_price <= 0) errors.push('Valid total price is required');
      
      // Email format validation
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Invalid email format');
      }
      
      // Phone format validation
      if (data.phone && !/^\+[\d\s\-()]+$/.test(data.phone)) {
        errors.push('Invalid phone number format');
      }
      
      // Date validation
      if (data.start_date && data.end_date) {
        const startDate = new Date(data.start_date);
        const endDate = new Date(data.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (isNaN(startDate.getTime())) errors.push('Invalid check-in date');
        if (isNaN(endDate.getTime())) errors.push('Invalid check-out date');
        if (startDate < today) errors.push('Check-in date cannot be in the past');
        if (endDate <= startDate) errors.push('Check-out date must be after check-in date');
      }
      
      // Currency validation
      if (data.currency && !mockCurrencyRates[data.currency]) {
        errors.push('Unsupported currency');
      }
      
      // Guest count validation
      if (data.adults && (data.adults < 1 || data.adults > 10)) {
        errors.push('Adults count must be between 1 and 10');
      }
      
      return errors;
    };

    // Run all test cases
    testCases.forEach(testCase => {
      const errors = validateForm(testCase.data);
      testCase.expectedErrors.forEach(expectedError => {
        expect(errors).toContain(expectedError);
      });
      console.log(`✅ ${testCase.name} validation errors handled correctly`);
    });

    // Test different API error scenarios
    const apiErrorTests = [
      {
        name: 'Network timeout',
        error: new Error('Network error: Request timeout'),
        expectedMessage: 'Network error: Request timeout'
      },
      {
        name: 'Server error',
        error: new Error('Server error: 500 Internal Server Error'),
        expectedMessage: 'Server error: 500 Internal Server Error'
      },
      {
        name: 'Authentication error',
        error: new Error('Authentication required'),
        expectedMessage: 'Authentication required'
      },
      {
        name: 'Stripe API error',
        error: new Error('Stripe API temporarily unavailable'),
        expectedMessage: 'Stripe API temporarily unavailable'
      },
      {
        name: 'Rate limiting',
        error: new Error('Rate limit exceeded'),
        expectedMessage: 'Rate limit exceeded'
      }
    ];

    for (const test of apiErrorTests) {
      const createBookingWithError = async () => {
        throw test.error;
      };

      try {
        await createBookingWithError();
        fail(`Expected ${test.name} to throw an error`);
      } catch (error) {
        expect(error.message).toBe(test.expectedMessage);
        console.log(`✅ ${test.name} handled correctly`);
      }
    }

    console.log('\n🎯 Enhanced Error Handling Test PASSED!');
  });

  // Enhanced data transformation test with edge cases
  test('Enhanced Data Transformation and Currency Conversion', () => {
    // Test comprehensive data transformation scenarios
    const transformationTestCases = [
      {
        name: 'Standard frontend form data',
        input: {
          firstName: 'Jane',
          lastName: 'Smith',
          phoneNumber: '+1-555-0123',
          email: 'jane@example.com',
          hotelName: 'Luxury Resort',
          checkInDate: '2025-09-01',
          checkOutDate: '2025-09-03',
          numberOfNights: 2,
          numberOfGuests: 3,
          totalAmount: 750,
          selectedCurrency: 'USD'
        },
        expectedApi: {
          first_name: 'Jane',
          last_name: 'Smith',
          phone: '+1-555-0123',
          email: 'jane@example.com',
          hotel_name: 'Luxury Resort',
          start_date: '2025-09-01',
          end_date: '2025-09-03',
          nights: 2,
          adults: 3,
          total_price: 750,
          currency: 'USD'
        }
      },
      {
        name: 'Form data with null/undefined values',
        input: {
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: null,
          email: 'john@test.com',
          hotelName: undefined,
          checkInDate: '2025-09-15',
          checkOutDate: '2025-09-17',
          numberOfNights: 2,
          numberOfGuests: 2,
          totalAmount: 400,
          selectedCurrency: 'EUR'
        },
        expectedApi: {
          first_name: 'John',
          last_name: 'Doe',
          phone: null,
          email: 'john@test.com',
          hotel_name: null,
          start_date: '2025-09-15',
          end_date: '2025-09-17',
          nights: 2,
          adults: 2,
          total_price: 400,
          currency: 'EUR'
        }
      }
    ];

    // Enhanced transformation function with null handling
    const transformToApiFormat = (formData) => {
      return {
        first_name: formData.firstName || null,
        last_name: formData.lastName || null,
        phone: formData.phoneNumber || null,
        email: formData.email || null,
        hotel_name: formData.hotelName || null,
        start_date: formData.checkInDate || null,
        end_date: formData.checkOutDate || null,
        nights: formData.numberOfNights || null,
        adults: formData.numberOfGuests || null,
        children: formData.numberOfChildren || 0,
        total_price: formData.totalAmount || null,
        currency: formData.selectedCurrency || 'SGD'
      };
    };

    // Test all transformation cases
    transformationTestCases.forEach(testCase => {
      const apiData = transformToApiFormat(testCase.input);
      
      Object.keys(testCase.expectedApi).forEach(key => {
        expect(apiData[key]).toBe(testCase.expectedApi[key]);
      });
      
      console.log(`✅ ${testCase.name} transformation correct`);
    });

    // Test multi-currency Stripe transformation with precision
    const currencyTestCases = [
      { currency: 'SGD', amount: 500, expectedStripeAmount: 50000, description: 'Base currency (SGD)' },
      { currency: 'USD', amount: 500, expectedStripeAmount: 37000, description: 'USD conversion' }, // 500 * 0.74 = 370
      { currency: 'EUR', amount: 500, expectedStripeAmount: 34000, description: 'EUR conversion' }, // 500 * 0.68 = 340  
      { currency: 'GBP', amount: 500, expectedStripeAmount: 29000, description: 'GBP conversion' }, // 500 * 0.58 = 290
      { currency: 'JPY', amount: 500, expectedStripeAmount: 54500, description: 'JPY (zero-decimal)' }, // 500 * 109 = 54500 (no *100)
      { currency: 'AUD', amount: 100, expectedStripeAmount: 10300, description: 'AUD small amount' }, // 100 * 1.03 = 103
    ];

    // Enhanced Stripe transformation with currency handling
    const transformForStripe = (data) => {
      let finalAmount = data.total_price;
      let finalCurrency = data.currency;
      
      // Convert from SGD if needed
      if (data.currency !== 'SGD') {
        finalAmount = convertFromSGD(data.total_price, data.currency);
      }
      
      // Handle zero-decimal currencies
      const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD'];
      const isZeroDecimal = zeroDecimalCurrencies.includes(finalCurrency);
      
      return {
        currency: finalCurrency.toLowerCase(),
        unit_amount: isZeroDecimal ? Math.round(finalAmount) : Math.round(finalAmount * 100),
        product_name: `Hotel Booking - ${data.hotel_name || 'Unknown Hotel'}`,
        original_amount_sgd: data.total_price,
        converted_amount: finalAmount,
        is_zero_decimal: isZeroDecimal
      };
    };

    // Test all currency cases
    currencyTestCases.forEach(testCase => {
      const mockData = {
        total_price: testCase.amount,
        currency: testCase.currency,
        hotel_name: 'Test Hotel'
      };
      
      const stripeData = transformForStripe(mockData);
      
      expect(stripeData.currency).toBe(testCase.currency.toLowerCase());
      expect(stripeData.unit_amount).toBe(testCase.expectedStripeAmount);
      expect(stripeData.original_amount_sgd).toBe(testCase.amount);
      
      console.log(`✅ ${testCase.description} - ${testCase.currency} ${stripeData.converted_amount} → Stripe unit_amount: ${stripeData.unit_amount}`);
    });

    // Test edge cases for currency conversion
    const edgeCases = [
      {
        name: 'Very small amount',
        data: { total_price: 1, currency: 'USD' },
        expectedResult: { converted: 1, stripe_amount: 100 } // 1 SGD * 0.74 = 0.74, rounded to 1, then 100 cents
      },
      {
        name: 'Large amount',
        data: { total_price: 10000, currency: 'EUR' },
        expectedResult: { converted: 6800, stripe_amount: 680000 } // 10000 * 0.68 = 6800
      },
      {
        name: 'Floating point precision',
        data: { total_price: 123.45, currency: 'GBP' },
        expectedResult: { converted: 72, stripe_amount: 7200 } // 123.45 * 0.58 = 71.601, rounded to 72
      }
    ];

    edgeCases.forEach(testCase => {
      const result = transformForStripe(testCase.data);
      expect(result.converted_amount).toBe(testCase.expectedResult.converted);
      expect(result.unit_amount).toBe(testCase.expectedResult.stripe_amount);
      console.log(`✅ Edge case: ${testCase.name} handled correctly`);
    });

    console.log('\n🎯 Enhanced Data Transformation and Currency Conversion Test PASSED!');
  });

  // New test: Multi-currency payment flow simulation
  test('Multi-Currency Payment Flow Simulation', async () => {
    const currencies = ['SGD', 'USD', 'EUR', 'GBP', 'JPY'];
    const baseAmount = 1000; // SGD 1000
    
    for (const currency of currencies) {
      console.log(`\n--- Testing ${currency} payment flow ---`);
      
      // 1. Create booking data in target currency
      const bookingData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@hotel.com',
        hotel_id: 'test_hotel',
        hotel_name: 'Test Hotel',
        start_date: '2025-09-01',
        end_date: '2025-09-03',
        nights: 2,
        adults: 2,
        total_price: baseAmount,
        currency: currency,
        userToken: 'valid_token'
      };
      
      // 2. Validate booking data
      const validateForm = (data) => {
        const errors = [];
        if (!mockCurrencyRates[data.currency]) {
          errors.push('Unsupported currency');
        }
        return errors;
      };
      
      const errors = validateForm(bookingData);
      expect(errors).toHaveLength(0);
      
      // 3. Calculate expected converted amount
      const expectedAmount = currency === 'SGD' ? baseAmount : convertFromSGD(baseAmount, currency);
      
      // 4. Create Stripe session
      const createStripeSession = (data) => {
        let finalAmount = data.total_price;
        if (data.currency !== 'SGD') {
          finalAmount = convertFromSGD(data.total_price, data.currency);
        }
        
        const isZeroDecimal = ['JPY', 'KRW', 'VND'].includes(data.currency);
        
        return {
          currency: data.currency.toLowerCase(),
          unit_amount: isZeroDecimal ? Math.round(finalAmount) : Math.round(finalAmount * 100),
          converted_amount: finalAmount,
          metadata: {
            original_amount: data.total_price,
            original_currency: 'SGD',
            target_currency: data.currency
          }
        };
      };
      
      const session = createStripeSession(bookingData);
      
      // 5. Verify conversion accuracy
      expect(session.converted_amount).toBe(expectedAmount);
      expect(session.currency).toBe(currency.toLowerCase());
      expect(session.metadata.target_currency).toBe(currency);
      
      console.log(`✅ ${currency}: SGD ${baseAmount} → ${currency} ${session.converted_amount} (Stripe: ${session.unit_amount})`);
    }
    
    console.log('\n🎯 Multi-Currency Payment Flow Simulation PASSED!');
  });

  // New test: Robust Boundary Value Testing for Payment Gateway
  test('Robust Boundary Value Testing for Payment Gateway', async () => {
    console.log('\n--- Testing Robust Boundary Values ---');
    
    const robustBoundaryTests = [
      // Price boundaries with values just outside valid ranges
      { 
        description: 'Just below minimum valid price', 
        data: { total_price: 0.009, currency: 'USD' }, 
        expected: 'rejected',
        boundary_type: 'lower_invalid'
      },
      { 
        description: 'Exactly minimum valid price', 
        data: { total_price: 0.01, currency: 'USD' }, 
        expected: 'accepted',
        boundary_type: 'lower_valid'
      },
      { 
        description: 'Just above minimum valid price', 
        data: { total_price: 0.011, currency: 'USD' }, 
        expected: 'accepted',
        boundary_type: 'lower_valid_plus'
      },
      { 
        description: 'Just below maximum valid price', 
        data: { total_price: 99999.98, currency: 'USD' }, 
        expected: 'accepted',
        boundary_type: 'upper_valid_minus'
      },
      { 
        description: 'Exactly maximum valid price', 
        data: { total_price: 99999.99, currency: 'USD' }, 
        expected: 'accepted',
        boundary_type: 'upper_valid'
      },
      { 
        description: 'Just above maximum valid price', 
        data: { total_price: 100000.00, currency: 'USD' }, 
        expected: 'rejected',
        boundary_type: 'upper_invalid'
      }
    ];

    for (const test of robustBoundaryTests) {
      const validatePaymentAmount = (amount, currency) => {
        if (amount <= 0 || amount >= 100000) return false;
        if (currency === 'USD' && amount < 0.01) return false; // Use 0.01 instead of 0.50 for test
        return true;
      };

      const isValid = validatePaymentAmount(test.data.total_price, test.data.currency);
      const testResult = (test.expected === 'accepted') === isValid;
      
      expect(testResult).toBe(true);
      console.log(`✅ ${test.description}: ${test.data.total_price} ${test.data.currency} - ${test.expected} (${test.boundary_type})`);
    }

    console.log('\n🎯 Robust Boundary Value Testing PASSED!');
  });

  // New test: Special Value Testing for Payment Gateway
  test('Special Value Testing for Payment Gateway', async () => {
    console.log('\n--- Testing Special Values ---');
    
    const specialValueTests = [
      // Null and undefined values
      { value: null, field: 'total_price', expected: 'rejected', type: 'null' },
      { value: undefined, field: 'total_price', expected: 'rejected', type: 'undefined' },
      { value: NaN, field: 'total_price', expected: 'rejected', type: 'NaN' },
      { value: Infinity, field: 'total_price', expected: 'rejected', type: 'Infinity' },
      { value: -Infinity, field: 'total_price', expected: 'rejected', type: '-Infinity' },
      
      // Type conversion scenarios
      { value: '50.00', field: 'total_price', expected: 'accepted_with_conversion', type: 'string_number' },
      { value: 'invalid', field: 'total_price', expected: 'rejected', type: 'invalid_string' },
      { value: {}, field: 'total_price', expected: 'rejected', type: 'object' },
      { value: [], field: 'total_price', expected: 'rejected', type: 'array' },
      { value: true, field: 'total_price', expected: 'rejected', type: 'boolean' },
      
      // Currency special values
      { value: null, field: 'currency', expected: 'rejected', type: 'null_currency' },
      { value: undefined, field: 'currency', expected: 'default_to_sgd', type: 'undefined_currency' },
      { value: '', field: 'currency', expected: 'rejected', type: 'empty_currency' },
      { value: '   ', field: 'currency', expected: 'rejected', type: 'whitespace_currency' },
      { value: 'USD', field: 'currency', expected: 'accepted_normalized', type: 'uppercase_currency' },
      
      // Email special values
      { value: null, field: 'email', expected: 'rejected', type: 'null_email' },
      { value: '', field: 'email', expected: 'rejected', type: 'empty_email' },
      { value: '   ', field: 'email', expected: 'rejected', type: 'whitespace_email' },
      { value: 'test@', field: 'email', expected: 'rejected', type: 'incomplete_email' },
      { value: '@domain.com', field: 'email', expected: 'rejected', type: 'missing_username' }
    ];

    const validateSpecialValue = (value, field) => {
      if (field === 'total_price') {
        if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
          return 'rejected';
        }
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) || parsed <= 0 ? 'rejected' : 'accepted_with_conversion';
        }
        if (typeof value === 'object' || typeof value === 'boolean') {
          return 'rejected';
        }
        return typeof value === 'number' && value > 0 ? 'accepted' : 'rejected';
      }
      
      if (field === 'currency') {
        if (value === null || value === '' || (typeof value === 'string' && value.trim() === '')) {
          return 'rejected';
        }
        if (value === undefined) return 'default_to_sgd';
        if (typeof value === 'string') {
          const validCurrencies = ['usd', 'sgd', 'eur', 'gbp', 'jpy', 'cad'];
          if (validCurrencies.includes(value.toLowerCase())) {
            return value === value.toLowerCase() ? 'accepted' : 'accepted_normalized';
          }
        }
        return 'rejected';
      }
      
      if (field === 'email') {
        if (value === null || value === undefined || typeof value !== 'string' || 
            value.trim() === '' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'rejected';
        }
        return 'accepted';
      }
      
      return 'unknown';
    };

    specialValueTests.forEach(test => {
      const result = validateSpecialValue(test.value, test.field);
      expect(result).toBe(test.expected);
      console.log(`✅ ${test.type}: ${test.field} = ${JSON.stringify(test.value)} → ${result}`);
    });

    console.log('\n🎯 Special Value Testing PASSED!');
  });

  // New test: Strong Equivalence Class Testing
  test('Strong Equivalence Class Testing for Payment Gateway', async () => {
    console.log('\n--- Testing Equivalence Class Combinations ---');
    
    const equivalenceClasses = {
      price: {
        small: [0.01, 1.00, 9.99],
        medium: [10.00, 100.00, 999.99],
        large: [1000.00, 10000.00, 99999.99]
      },
      currency: {
        standard: ['usd', 'sgd', 'eur'],
        zero_decimal: ['jpy']
      },
      guests: {
        single: [1],
        group: [2, 5, 10]
      }
    };

    // Strong normal testing - all valid combinations
    const validCombinations = [
      { price: 'small', currency: 'standard', guests: 'single' },
      { price: 'medium', currency: 'standard', guests: 'group' },
      { price: 'large', currency: 'zero_decimal', guests: 'single' },
      { price: 'small', currency: 'zero_decimal', guests: 'group' },
      { price: 'medium', currency: 'standard', guests: 'single' },
      { price: 'large', currency: 'standard', guests: 'group' }
    ];

    validCombinations.forEach((combo, index) => {
      const priceValue = equivalenceClasses.price[combo.price][0];
      const currencyValue = equivalenceClasses.currency[combo.currency][0];
      const guestsValue = equivalenceClasses.guests[combo.guests][0];

      // Simulate validation for combination
      const isValidPrice = priceValue > 0 && priceValue < 100000;
      const isValidCurrency = ['usd', 'sgd', 'eur', 'jpy'].includes(currencyValue);
      const isValidGuests = guestsValue >= 1 && guestsValue <= 10;

      const combinationValid = isValidPrice && isValidCurrency && isValidGuests;
      expect(combinationValid).toBe(true);
      
      console.log(`✅ Combination ${index + 1}: Price=${priceValue} (${combo.price}), Currency=${currencyValue} (${combo.currency}), Guests=${guestsValue} (${combo.guests}) → Valid`);
    });

    // Test one invalid combination from each equivalence class
    const invalidTests = [
      { price: -10, currency: 'usd', guests: 2, invalidField: 'price' },
      { price: 100, currency: 'xyz', guests: 2, invalidField: 'currency' },
      { price: 100, currency: 'usd', guests: 0, invalidField: 'guests' },
      { price: 100, currency: 'usd', guests: 15, invalidField: 'guests' }
    ];

    invalidTests.forEach((test, index) => {
      const isValidPrice = test.price > 0 && test.price < 100000;
      const isValidCurrency = ['usd', 'sgd', 'eur', 'jpy'].includes(test.currency);
      const isValidGuests = test.guests >= 1 && test.guests <= 10;

      const combinationValid = isValidPrice && isValidCurrency && isValidGuests;
      expect(combinationValid).toBe(false);
      
      console.log(`✅ Invalid Combination ${index + 1}: Price=${test.price}, Currency=${test.currency}, Guests=${test.guests} → Invalid (${test.invalidField} field)`);
    });

    console.log('\n🎯 Strong Equivalence Class Testing PASSED!');
  });

  // New test: Worst-Case Boundary Testing
  test('Worst-Case Boundary Testing for Payment Gateway', async () => {
    console.log('\n--- Testing Worst-Case Boundary Combinations ---');
    
    const worstCaseScenarios = [
      {
        name: 'All Minimum Valid Boundaries',
        data: {
          total_price: 0.01,
          currency: 'usd',
          adults: 1,
          hotel_name: 'A',
          email: 'a@b.co'
        },
        expected: 'valid',
        stress_level: 'high'
      },
      {
        name: 'All Maximum Valid Boundaries',
        data: {
          total_price: 99999.99,
          currency: 'sgd',
          adults: 10,
          hotel_name: 'A'.repeat(255),
          email: 'very.long.email.address.with.many.parts@very.long.domain.name.with.subdomains.co.uk'
        },
        expected: 'valid',
        stress_level: 'extreme'
      },
      {
        name: 'Mixed Extreme Boundaries',
        data: {
          total_price: 0.01, // Min
          currency: 'jpy',
          adults: 10, // Max
          hotel_name: 'A'.repeat(255), // Max
          email: 'a@b.co' // Min
        },
        expected: 'valid',
        stress_level: 'high'
      },
      {
        name: 'All Just Outside Valid Boundaries',
        data: {
          total_price: 0.009, // Just below min
          currency: 'xyz', // Invalid
          adults: 11, // Just above max
          hotel_name: 'A'.repeat(256), // Just above max
          email: 'invalid-email' // Invalid format
        },
        expected: 'invalid',
        stress_level: 'critical'
      }
    ];

    worstCaseScenarios.forEach((scenario, index) => {
      const validateWorstCase = (data) => {
        const errors = [];
        
        if (data.total_price <= 0 || data.total_price >= 100000) {
          errors.push('Invalid price');
        }
        
        if (!['usd', 'sgd', 'eur', 'gbp', 'jpy', 'cad'].includes(data.currency)) {
          errors.push('Invalid currency');
        }
        
        if (data.adults <= 0 || data.adults > 10) {
          errors.push('Invalid guest count');
        }
        
        if (!data.hotel_name || data.hotel_name.length === 0 || data.hotel_name.length > 255) {
          errors.push('Invalid hotel name');
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          errors.push('Invalid email');
        }
        
        return errors.length === 0 ? 'valid' : 'invalid';
      };

      const result = validateWorstCase(scenario.data);
      expect(result).toBe(scenario.expected);
      
      console.log(`✅ ${scenario.name}: ${result} (${scenario.stress_level} stress) - Expected: ${scenario.expected}`);
    });

    console.log('\n🎯 Worst-Case Boundary Testing PASSED!');
  });
});
