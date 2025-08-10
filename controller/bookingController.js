import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import BookingModel from '../model/booking.js';
import stripe from '../config/stripe.js';

const router = express.Router();

// Test endpoint to verify the route is working (no auth required for testing)
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Booking controller is working',
        timestamp: new Date().toISOString()
    });
});

// POST /bookings/create-payment-session - Create Stripe session (TEMPORARY: No auth for testing)
router.post('/create-payment-session-no-auth', async (req, res) => {
    try {
        // TEMPORARY: Use mock user data for testing
        const userId = 'test-user-123';
        const userEmail = 'test@example.com';
        
        console.log(`Creating payment session for test user: ${userId} (${userEmail})`);
        console.log('Request body:', req.body);
        
        // Check Stripe configuration first
        if (!stripe) {
            console.warn('Stripe not configured - check STRIPE_SECRET_KEY environment variable');
            return res.status(500).json({
                success: false,
                message: 'Payment system not configured. Please contact support.',
                error: 'STRIPE_NOT_CONFIGURED'
            });
        }
        
        // Use mock data if real data not provided (for testing incomplete features)
        const mockBookingData = {
            hotel_id: 'hotel-marina-123',
            hotel_name: 'Grand Marina Hotel Singapore',
            start_date: '2024-04-01',
            end_date: '2024-04-03',
            nights: 2,
            adults: 2,
            children: 0,
            room_type: 'Deluxe Suite',
            total_price: 500,
            currency: 'SGD',
            first_name: 'Test',
            last_name: 'User',
            phone: '+447415356955',
            email: userEmail
        };

        // Use actual data if provided, otherwise use mock data
        const bookingData = {
            // Hotel info
            hotel_id: req.body.hotel_id || mockBookingData.hotel_id,
            hotel_name: req.body.hotel_name || req.body.hotelName || mockBookingData.hotel_name,
            
            // Dates - handle both backend and frontend field names
            start_date: req.body.start_date || req.body.checkInDate || mockBookingData.start_date,
            end_date: req.body.end_date || req.body.checkOutDate || mockBookingData.end_date,
            nights: req.body.nights || req.body.numberOfNights || mockBookingData.nights,
            
            // Guests
            adults: req.body.adults || req.body.numberOfGuests || mockBookingData.adults,
            children: req.body.children || 0,
            
            // Room and pricing - handle both backend and frontend field names
            room_type: req.body.room_type || req.body.roomType || mockBookingData.room_type,
            total_price: req.body.total_price || req.body.totalAmount || mockBookingData.total_price,
            currency: req.body.currency || mockBookingData.currency,
            
            // Guest info - handle both backend and frontend field names
            first_name: req.body.first_name || req.body.guestName?.split(' ')[0] || mockBookingData.first_name,
            last_name: req.body.last_name || req.body.guestName?.split(' ').slice(1).join(' ') || mockBookingData.last_name,
            phone: req.body.phone || mockBookingData.phone,
            email: userEmail,
            
            // Optional fields
            special_requests: req.body.special_requests || null
        };
        
        console.log('Booking data for payment session:', {
            hotel: bookingData.hotel_name,
            dates: `${bookingData.start_date} to ${bookingData.end_date}`,
            price: `${bookingData.currency} ${bookingData.total_price}`,
            guest: `${bookingData.first_name} ${bookingData.last_name}`,
            using_mock: !req.body.hotel_id ? '(using mock data)' : '(real data)'
        });

        // Validate essential data for Stripe
        if (!bookingData.total_price || bookingData.total_price <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid total price is required for payment'
            });
        }

        try {
            console.log('Creating Stripe checkout session...');
            
            // Create Stripe checkout session
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: bookingData.currency?.toLowerCase() || 'sgd',
                        product_data: {
                            name: `Hotel Booking - ${bookingData.hotel_name}`,
                            description: `${bookingData.nights} night(s) from ${bookingData.start_date} to ${bookingData.end_date} for ${bookingData.adults} guest(s)`,
                        },
                        unit_amount: Math.round(bookingData.total_price * 100), // Convert to cents
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking-cancel`,
                metadata: {
                    user_id: userId,
                    user_email: userEmail,
                    // Store all booking data in metadata for later retrieval
                    booking_data: JSON.stringify(bookingData)
                }
            });
            
            console.log('Stripe session created:', session.id);
            
            // Return payment URL - NO DATABASE SAVE YET
            res.status(200).json({
                success: true,
                message: 'Payment session created. Booking will be saved after successful payment.',
                session_id: session.id,
                payment_url: session.url,
                bookingPreview: {
                    hotel: bookingData.hotel_name,
                    dates: `${bookingData.start_date} to ${bookingData.end_date}`,
                    guests: bookingData.adults + (bookingData.children || 0),
                    total: `${bookingData.currency} ${bookingData.total_price}`
                }
            });
            
        } catch (paymentError) {
            console.error('❌ Payment session creation failed:', paymentError);
            console.error('❌ Error details:', {
                message: paymentError.message,
                stack: paymentError.stack,
                code: paymentError.code
            });
            
            res.status(500).json({
                success: false,
                message: 'Failed to create payment session',
                error: 'Payment gateway error',
                details: process.env.NODE_ENV === 'development' ? paymentError.message : undefined
            });
        }
        
    } catch (error) {
        console.error('❌ Error creating payment session:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to create payment session',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// All booking routes require authentication
router.use(verifyToken);

// GET /bookings - Get user's bookings (Protected Route, login required)
router.get('/', async (req, res) => {
    try {
        // User info extracted from JWT token by verifyToken middleware
        const userId = res.locals.userId;
        const userEmail = res.locals.email;
        
        console.log(`Fetching bookings for user: ${userId} (${userEmail})`);
        
        // Get real bookings from database by user email
        const bookings = await BookingModel.findByUserEmail(userEmail);
        
        // Transform database format to API format
        const transformedBookings = bookings.map(booking => ({
            id: booking.id,
            userId: userId,
            hotelId: booking.hotel_id,
            hotelName: booking.hotel_name || 'Hotel Name Not Available',
            checkIn: booking.start_date,
            checkOut: booking.end_date,
            nights: booking.nights,
            guests: booking.adults + (booking.children || 0),
            totalPrice: parseFloat(booking.total_price),
            currency: booking.currency,
            status: booking.booking_status,
            createdAt: booking.created_at
        }));
        
        res.status(200).json({
            success: true,
            message: `Found ${transformedBookings.length} bookings for user ${userId}`,
            bookings: transformedBookings
        });
        
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bookings',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// POST /bookings/create-payment-session - Create Stripe session
router.post('/create-payment-session', async (req, res) => {
    try {
        // User info from JWT token
        const userId = res.locals.userId;
        const userEmail = res.locals.email;
        
        console.log(`Creating payment session for user: ${userId} (${userEmail})`);
        console.log('Request body:', req.body);
        
        // Check Stripe configuration first
        if (!stripe) {
            console.warn('⚠️ Stripe not configured - check STRIPE_SECRET_KEY environment variable');
            return res.status(500).json({
                success: false,
                message: 'Payment system not configured. Please contact support.',
                error: 'STRIPE_NOT_CONFIGURED'
            });
        }
        
        // Use mock data if real data not provided (for testing incomplete features)
        const mockBookingData = {
            hotel_id: 'hotel-marina-123',
            hotel_name: 'Grand Marina Hotel Singapore',
            start_date: '2024-04-01',
            end_date: '2024-04-03',
            nights: 2,
            adults: 2,
            children: 0,
            room_type: 'Deluxe Suite',
            total_price: 500,
            currency: 'SGD',
            first_name: 'Dinh Van',
            last_name: 'Ky',
            phone: '+447415356955',
            email: userEmail
        };

        // Use actual data if provided, otherwise use mock data
        const bookingData = {
            // Hotel info
            hotel_id: req.body.hotel_id || mockBookingData.hotel_id,
            hotel_name: req.body.hotel_name || req.body.hotelName || mockBookingData.hotel_name,
            
            // Dates - handle both backend and frontend field names
            start_date: req.body.start_date || req.body.checkInDate || mockBookingData.start_date,
            end_date: req.body.end_date || req.body.checkOutDate || mockBookingData.end_date,
            nights: req.body.nights || req.body.numberOfNights || mockBookingData.nights,
            
            // Guests
            adults: req.body.adults || req.body.numberOfGuests || mockBookingData.adults,
            children: req.body.children || 0,
            
            // Room and pricing - handle both backend and frontend field names
            room_type: req.body.room_type || req.body.roomType || mockBookingData.room_type,
            total_price: req.body.total_price || req.body.totalAmount || mockBookingData.total_price,
            currency: req.body.currency || mockBookingData.currency,
            
            // Guest info - handle both backend and frontend field names
            first_name: req.body.first_name || req.body.guestName?.split(' ')[0] || mockBookingData.first_name,
            last_name: req.body.last_name || req.body.guestName?.split(' ').slice(1).join(' ') || mockBookingData.last_name,
            phone: req.body.phone || mockBookingData.phone,
            email: userEmail,
            
            // Optional fields
            special_requests: req.body.special_requests || null
        };
        
        console.log('Booking data for payment session:', {
            hotel: bookingData.hotel_name,
            dates: `${bookingData.start_date} to ${bookingData.end_date}`,
            price: `${bookingData.currency} ${bookingData.total_price}`,
            guest: `${bookingData.first_name} ${bookingData.last_name}`,
            using_mock: !req.body.hotel_id ? '(using mock data)' : '(real data)'
        });

        // Validate essential data for Stripe
        if (!bookingData.total_price || bookingData.total_price <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid total price is required for payment'
            });
        }

        try {
            console.log('Creating Stripe checkout session...');
            
            // Create Stripe checkout session
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: bookingData.currency?.toLowerCase() || 'sgd',
                        product_data: {
                            name: `Hotel Booking - ${bookingData.hotel_name}`,
                            description: `${bookingData.nights} night(s) from ${bookingData.start_date} to ${bookingData.end_date} for ${bookingData.adults} guest(s)`,
                        },
                        unit_amount: Math.round(bookingData.total_price * 100), // Convert to cents
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking-cancel`,
                metadata: {
                    user_id: userId,
                    user_email: userEmail,
                    // Store all booking data in metadata for later retrieval
                    booking_data: JSON.stringify(bookingData)
                }
            });
            
            console.log('Stripe session created:', session.id);
            
            // Return payment URL - NO DATABASE SAVE YET
            res.status(200).json({
                success: true,
                message: 'Payment session created. Booking will be saved after successful payment.',
                session_id: session.id,
                payment_url: session.url,
                bookingPreview: {
                    hotel: bookingData.hotel_name,
                    dates: `${bookingData.start_date} to ${bookingData.end_date}`,
                    guests: bookingData.adults + (bookingData.children || 0),
                    total: `${bookingData.currency} ${bookingData.total_price}`
                }
            });
            
        } catch (paymentError) {
            console.error('❌ Payment session creation failed:', paymentError);
            console.error('❌ Error details:', {
                message: paymentError.message,
                stack: paymentError.stack,
                code: paymentError.code
            });
            
            res.status(500).json({
                success: false,
                message: 'Failed to create payment session',
                error: 'Payment gateway error',
                details: process.env.NODE_ENV === 'development' ? paymentError.message : undefined
            });
        }
        
    } catch (error) {
        console.error('❌ Error creating payment session:', error);
        console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        
        res.status(500).json({
            success: false,
            message: 'Failed to create payment session',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// Webhook route should NOT use verifyToken middleware as it comes from Stripe
// Create a separate router for webhook
const webhookRouter = express.Router();

// POST /webhook - Stripe webhook for payment notifications (NO AUTH REQUIRED)
webhookRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
        if (!stripe || !endpointSecret) {
            console.log('Stripe webhook not configured');
            return res.status(400).send('Webhook configuration missing');
        }
        
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.log(`❌ Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        try {
            console.log('Payment successful via webhook:', session.id);
            
            // Extract booking data from session metadata
            const bookingData = JSON.parse(session.metadata.booking_data);
            
            // Save booking to database
            const newBooking = await BookingModel.create({
                ...bookingData,
                booking_status: 'confirmed',
                payment_reference: session.payment_intent
            });
            
            console.log('✅ Booking auto-saved via webhook:', newBooking.id);
            
        } catch (error) {
            console.error('❌ Error saving booking via webhook:', error);
        }
    }
    
    res.json({ received: true });
});

// POST /bookings/confirm-payment - Save booking AFTER successful payment
router.post('/confirm-payment', async (req, res) => {
    try {
        const { sessionId } = req.body;
        const userId = res.locals.userId;
        const userEmail = res.locals.email;
        
        console.log(`Confirming payment for session: ${sessionId}`);

        if (!stripe) {
            return res.status(500).json({
                success: false,
                message: 'Stripe not configured'
            });
        }

        // Retrieve payment session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status !== 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Payment not completed',
                status: session.payment_status
            });
        }

        // Extract booking data from session metadata
        const bookingData = JSON.parse(session.metadata.booking_data);
        
        console.log('Payment confirmed, saving booking to database...');
        
        // NOW save to database after payment success
        const newBooking = await BookingModel.create({
            ...bookingData,
            booking_status: 'confirmed', // Mark as confirmed since payment is done
            payment_reference: session.payment_intent
        });
        
        console.log('✅ Booking saved successfully:', newBooking.id);
        
        res.status(201).json({
            success: true,
            message: 'Payment confirmed and booking saved successfully',
            booking: {
                id: newBooking.id,
                status: 'confirmed',
                hotelName: bookingData.hotel_name,
                checkIn: bookingData.start_date,
                checkOut: bookingData.end_date,
                totalPrice: bookingData.total_price,
                currency: bookingData.currency,
                paymentReference: session.payment_intent
            }
        });
        
    } catch (error) {
        console.error('❌ Error confirming payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm payment and save booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// POST /bookings - Create new booking with payment flow (Protected Route)
// This implements the sequence diagram: Create Booking UI → Booking Controller → Payment Gateway → Database
router.post('/', async (req, res) => {
    try {
        // User info from JWT token
        const userId = res.locals.userId;
        const userEmail = res.locals.email;
        
        console.log(`Creating booking for user: ${userId} (${userEmail})`);
        
        const bookingData = {
            ...req.body,
            email: userEmail  // Use authenticated user's email
        };
        
        // 1.1.1: Validate Form Data (from sequence diagram)
        const validationErrors = BookingModel.validateBookingData(bookingData);
        
        if (validationErrors.length > 0) {
            // 1.1.2.2.2: Show Form Error (from sequence diagram)
            console.log('Validation failed:', validationErrors);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }
        
        // Calculate nights if not provided
        if (!bookingData.nights && bookingData.start_date && bookingData.end_date) {
            const startDate = new Date(bookingData.start_date);
            const endDate = new Date(bookingData.end_date);
            bookingData.nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        }
        
        // Create booking in database with status 'pending'
        const newBooking = await BookingModel.create(bookingData);
        console.log('Booking created in database:', newBooking.id);
        
        // Create Stripe payment session (Payment Gateway from sequence diagram)
        if (!stripe) {
            // If Stripe not configured, update booking as confirmed (for testing)
            await BookingModel.updateStatus(newBooking.id, 'confirmed', 'TEST_PAYMENT');
            
            return res.status(201).json({
                success: true,
                message: 'Booking created successfully (test mode)',
                booking: {
                    id: newBooking.id,
                    status: 'confirmed',
                    totalPrice: newBooking.total_price,
                    currency: newBooking.currency,
                    testMode: true
                }
            });
        }
        
        try {
            // Create Stripe checkout session
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: bookingData.currency?.toLowerCase() || 'sgd',
                        product_data: {
                            name: `Hotel Booking - ${bookingData.hotel_name || 'Hotel Stay'}`,
                            description: `${bookingData.nights} night(s) from ${bookingData.start_date} to ${bookingData.end_date}`,
                        },
                        unit_amount: Math.round(bookingData.total_price * 100), // Convert to cents
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking-success?session_id={CHECKOUT_SESSION_ID}&booking_id=${newBooking.id}`,
                cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking-cancel?booking_id=${newBooking.id}`,
                metadata: {
                    booking_id: newBooking.id,
                    user_id: userId,
                    user_email: userEmail
                }
            });
            
            console.log('Stripe session created:', session.id);
            
            // Return booking with payment URL
            res.status(201).json({
                success: true,
                message: 'Booking created, redirecting to payment',
                booking: {
                    id: newBooking.id,
                    status: 'pending',
                    totalPrice: newBooking.total_price,
                    currency: newBooking.currency
                },
                payment: {
                    sessionId: session.id,
                    url: session.url
                }
            });
            
        } catch (paymentError) {
            console.error('Payment session creation failed:', paymentError);
            
            // 1.1.2.2.1.2: Show Payment Error & Backup ID (from sequence diagram)
            // Keep booking in database but mark as payment_failed
            await BookingModel.updateStatus(newBooking.id, 'pending', `PAYMENT_ERROR_${Date.now()}`);
            
            res.status(500).json({
                success: false,
                message: 'Booking created but payment processing failed',
                error: 'Payment gateway error',
                booking: {
                    id: newBooking.id,
                    status: 'pending'
                },
                backupId: newBooking.id // For retry attempts
            });
        }
        
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// POST /bookings/:id/confirm-payment - Handle payment success callback
// This implements: [Payment Success] → 1.1.2.1.1: Reduce to Confirmation Page & Backup Save
router.post('/:id/confirm-payment', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { sessionId, paymentIntentId } = req.body;
        
        console.log(`Confirming payment for booking: ${bookingId}`);
        
        // Verify payment with Stripe if session provided
        if (stripe && sessionId) {
            try {
                const session = await stripe.checkout.sessions.retrieve(sessionId);
                
                if (session.payment_status === 'paid') {
                    // 1.1.2.1.1: Backup Save - Update booking status to confirmed
                    await BookingModel.updateStatus(bookingId, 'confirmed', session.payment_intent);
                    
                    res.status(200).json({
                        success: true,
                        message: 'Payment confirmed successfully',
                        booking: {
                            id: bookingId,
                            status: 'confirmed',
                            paymentReference: session.payment_intent
                        }
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        message: 'Payment not completed',
                        status: session.payment_status
                    });
                }
            } catch (stripeError) {
                console.error('Stripe verification failed:', stripeError);
                res.status(500).json({
                    success: false,
                    message: 'Payment verification failed'
                });
            }
        } else {
            // Fallback confirmation without Stripe
            await BookingModel.updateStatus(bookingId, 'confirmed', paymentIntentId || 'MANUAL_CONFIRMATION');
            
            res.status(200).json({
                success: true,
                message: 'Booking confirmed',
                booking: {
                    id: bookingId,
                    status: 'confirmed'
                }
            });
        }
        
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm payment',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// GET /bookings/:id - Get specific booking details
router.get('/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userEmail = res.locals.email;
        
        console.log(`Fetching booking details: ${bookingId} for user: ${userEmail}`);
        
        const booking = await BookingModel.findById(bookingId);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        // Verify booking belongs to authenticated user
        if (booking.email !== userEmail) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this booking'
            });
        }
        
        res.status(200).json({
            success: true,
            booking: {
                id: booking.id,
                hotelId: booking.hotel_id,
                hotelName: booking.hotel_name,
                checkIn: booking.start_date,
                checkOut: booking.end_date,
                nights: booking.nights,
                adults: booking.adults,
                children: booking.children,
                totalPrice: parseFloat(booking.total_price),
                currency: booking.currency,
                status: booking.booking_status,
                guestInfo: {
                    firstName: booking.first_name,
                    lastName: booking.last_name,
                    email: booking.email,
                    phone: booking.phone
                },
                createdAt: booking.created_at,
                updatedAt: booking.updated_at
            }
        });
        
    } catch (error) {
        console.error('Error fetching booking details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch booking details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

export default { 
    router,
    webhookRouter 
};