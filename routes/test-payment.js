import express from 'express';
import stripe from '../config/stripe.js';
import config from '../config/config.js';

const router = express.Router();

// Test route to check payment system without database
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Test payment routes are working!',
        timestamp: new Date().toISOString(),
        stripe_configured: !!stripe,
        stripe_status: stripe ? 'Ready' : 'Missing STRIPE_SECRET_KEY'
    });
});

// Test Stripe configuration
router.get('/stripe-test', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({
                success: false,
                message: 'Stripe not configured - missing STRIPE_SECRET_KEY',
                timestamp: new Date().toISOString()
            });
        }

        // Test Stripe connection by creating a test customer
        const testCustomer = await stripe.customers.create({
            email: 'test@example.com',
            name: 'Test Customer',
            metadata: {
                test: 'true',
                created_by: 'api_test'
            }
        });

        // Immediately delete the test customer
        await stripe.customers.del(testCustomer.id);

        res.json({
            success: true,
            message: 'Stripe connection successful!',
            test_customer_created: testCustomer.id,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Stripe test error:', error);
        res.status(500).json({
            success: false,
            message: 'Stripe connection failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Create test payment session (no database required)
router.post('/create-session', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({
                success: false,
                message: 'Stripe not configured - missing STRIPE_SECRET_KEY',
                timestamp: new Date().toISOString()
            });
        }

        const {
            amount = 10000, // Default $100.00
            currency = 'usd',
            hotelName = 'Test Hotel',
            customerEmail = 'test@example.com'
        } = req.body;

        console.log('Creating test payment session:', { amount, currency, hotelName, customerEmail });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency,
                        product_data: {
                            name: `Hotel Booking - ${hotelName}`,
                            description: 'Test booking payment session',
                        },
                        unit_amount: amount, // Amount in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            customer_email: customerEmail,
            success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking/cancel`,
            metadata: {
                test_booking: 'true',
                hotel_name: hotelName,
                timestamp: new Date().toISOString()
            }
        });

        console.log('Test payment session created:', session.id);

        res.json({
            success: true,
            sessionId: session.id,
            url: session.url,
            amount: amount,
            currency: currency,
            hotel: hotelName,
            customer: customerEmail,
            message: 'Test payment session created successfully!',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Test payment session creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test payment session',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Verify test payment session
router.get('/verify-session/:sessionId', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({
                success: false,
                message: 'Stripe not configured - missing STRIPE_SECRET_KEY',
                timestamp: new Date().toISOString()
            });
        }

        const { sessionId } = req.params;
        
        console.log('Verifying test payment session:', sessionId);

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        res.json({
            success: true,
            session: {
                id: session.id,
                payment_status: session.payment_status,
                amount_total: session.amount_total,
                currency: session.currency,
                customer_email: session.customer_email,
                created: new Date(session.created * 1000).toISOString(),
                metadata: session.metadata
            },
            message: 'Test payment session retrieved successfully!',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Test payment session verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify test payment session',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Mock booking data for testing (no database)
const mockBookings = [];

// Create test booking (no database)
router.post('/create-booking', (req, res) => {
    try {
        const {
            hotelName = 'Test Hotel',
            checkIn = '2024-12-01',
            checkOut = '2024-12-03',
            guests = 2,
            roomType = 'Standard',
            customerEmail = 'test@example.com',
            customerName = 'Test Customer'
        } = req.body;

        const bookingId = `TEST_${Date.now()}`;
        const booking = {
            id: bookingId,
            hotelName,
            checkIn,
            checkOut,
            guests,
            roomType,
            customerEmail,
            customerName,
            status: 'pending',
            createdAt: new Date().toISOString(),
            totalPrice: 200.00,
            currency: 'USD'
        };

        mockBookings.push(booking);

        console.log('Test booking created:', bookingId);

        res.json({
            success: true,
            booking: booking,
            message: 'Test booking created successfully!',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Test booking creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test booking',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get all test bookings
router.get('/bookings', (req, res) => {
    res.json({
        success: true,
        bookings: mockBookings,
        count: mockBookings.length,
        message: 'Test bookings retrieved successfully!',
        timestamp: new Date().toISOString()
    });
});

// Complete test workflow (booking + payment)
router.post('/complete-workflow', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({
                success: false,
                message: 'Stripe not configured - missing STRIPE_SECRET_KEY',
                timestamp: new Date().toISOString()
            });
        }

        const {
            hotelName = 'Test Hotel Complete',
            customerEmail = 'workflow@test.com',
            amount = 15000 // $150.00
        } = req.body;

        // 1. Create mock booking
        const bookingId = `WORKFLOW_${Date.now()}`;
        const booking = {
            id: bookingId,
            hotelName,
            customerEmail,
            checkIn: '2024-12-15',
            checkOut: '2024-12-17',
            guests: 2,
            roomType: 'Deluxe',
            status: 'pending',
            totalPrice: amount / 100,
            currency: 'USD',
            createdAt: new Date().toISOString()
        };

        mockBookings.push(booking);

        // 2. Create Stripe payment session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Hotel Booking - ${hotelName}`,
                            description: `Booking ID: ${bookingId}`,
                        },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            customer_email: customerEmail,
            success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking/cancel`,
            metadata: {
                booking_id: bookingId,
                test_workflow: 'true',
                hotel_name: hotelName
            }
        });

        console.log('Complete test workflow created:', { bookingId, sessionId: session.id });

        res.json({
            success: true,
            booking: booking,
            payment: {
                sessionId: session.id,
                url: session.url
            },
            workflow: {
                step1: 'Booking created',
                step2: 'Payment session created',
                next_action: 'Visit payment URL to complete payment'
            },
            message: 'Complete test workflow initiated!',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Complete workflow error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create complete test workflow',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default router;
