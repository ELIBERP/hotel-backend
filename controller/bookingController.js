import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import BookingModel from '../model/booking.js';
import stripe from '../config/stripe.js';
import { pool } from '../config/database.js';

const router = express.Router();

// Test endpoint to verify the route is working (no auth required for testing)
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Booking controller is working',
        timestamp: new Date().toISOString()
    });
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
            console.warn('WARNING: Stripe not configured - check STRIPE_SECRET_KEY environment variable');
            return res.status(500).json({
                success: false,
                message: 'Payment system not configured. Please contact support.',
                error: 'STRIPE_NOT_CONFIGURED'
            });
        }
        
        // Use actual data from request
        const bookingData = {
            // Hotel info
            hotel_id: req.body.hotel_id,
            hotel_name: req.body.hotel_name,
            
            // Dates - handle both backend and frontend field names
            start_date: req.body.start_date,
            end_date: req.body.end_date,
            nights: req.body.nights,
            
            // Guests
            adults: req.body.adults,
            children: req.body.children || 0,
            
            // Room and pricing - handle both backend and frontend field names
            room_type: req.body.room_type,
            room_types: req.body.room_types || [req.body.room_type || 'Standard Room'],
            total_price: req.body.total_price,
            currency: req.body.currency,
            
            // Guest info - handle both backend and frontend field names
            first_name: req.body.first_name,
            last_name: req.body.last_name,
            phone: req.body.phone,
            email: userEmail,
            
            // Optional fields
            special_requests: req.body.special_requests || null
        };
        
        console.log('Creating payment session for booking:', `${bookingData.currency} ${bookingData.total_price}`);

        // Validate essential data for Stripe
        if (!bookingData.total_price || bookingData.total_price <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid total price is required for payment'
            });
        }

        try {
            console.log('Creating Stripe checkout session...');
            
            // Generate unique booking ID to prevent duplicates
            const pendingBookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
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
                        unit_amount: (['JPY', 'KRW'].includes(bookingData.currency?.toUpperCase())) 
                            ? Math.round(bookingData.total_price) // Zero-decimal currencies: use amount as-is
                            : Math.round(bookingData.total_price * 100), // Other currencies: convert to cents
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/booking-cancel`,
                metadata: {
                    user_id: userId,
                    user_email: userEmail,
                    booking_id: pendingBookingId, 
                    // Store all booking data in metadata for later retrieval
                    booking_data: JSON.stringify(bookingData)
                }
            });
            
            console.log('Payment session created successfully:', session.id);

            // Create payment session record to track state
            try {
                await pool.execute(`
                    INSERT INTO payment_sessions (
                        id, booking_id, user_id, session_id, amount, currency,
                        session_data, status, expires_at, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 30 MINUTE), NOW())
                `, [
                    `ps_${Date.now()}`,
                    pendingBookingId,
                    userId,
                    session.id,
                    bookingData.total_price,
                    bookingData.currency,
                    JSON.stringify(bookingData)
                ]);
                console.log('Payment session tracked in database');
            } catch (dbError) {
                console.warn('Failed to track payment session:', dbError.message);
                // Continue anyway - don't fail the payment flow
            }
            
            // Return payment URL - NO BOOKING SAVE YET
            res.status(200).json({
                success: true,
                message: 'Payment session created. Booking will be saved after successful payment.',
                session_id: session.id,
                payment_url: session.url,
                booking_id: pendingBookingId, // Return booking ID for tracking
                bookingPreview: {
                    hotel: bookingData.hotel_name,
                    dates: `${bookingData.start_date} to ${bookingData.end_date}`,
                    guests: bookingData.adults + (bookingData.children || 0),
                    total: `${bookingData.currency} ${bookingData.total_price}`
                }
            });
            
        } catch (paymentError) {
            console.error('ERROR: Payment session creation failed:', paymentError.message);
            
            res.status(500).json({
                success: false,
                message: 'Failed to create payment session',
                error: 'Payment gateway error',
                details: process.env.NODE_ENV === 'development' ? paymentError.message : undefined
            });
        }
        
    } catch (error) {
        console.error('ERROR: Failed to create payment session:', error.message);
        
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
    console.log('WEBHOOK: Received Stripe webhook event');

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
        if (!stripe) {
            console.log('ERROR: Stripe not configured');
            return res.status(400).send('Stripe not configured');
        }
        
        if (!endpointSecret) {
            console.warn('WARNING: STRIPE_WEBHOOK_SECRET not configured - skipping signature verification (DEVELOPMENT ONLY)');
            // For development: try to parse the request body as JSON
            try {
                event = JSON.parse(req.body.toString());
                console.log('WEBHOOK: Parsed event without signature verification:', event.type);
            } catch (parseError) {
                console.error('ERROR: Failed to parse webhook body:', parseError.message);
                return res.status(400).send('Invalid JSON body');
            }
        } else {
            console.log('WEBHOOK: Verifying signature...');
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
            console.log('WEBHOOK: Signature verified successfully');
        }
    } catch (err) {
        console.log('ERROR: Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    console.log('WEBHOOK: Processing event type:', event.type);
    
    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        try {
            console.log('WEBHOOK: Payment successful for session:', session.id);
            
            // Check if this payment session already processed to prevent duplicates
            const [existingSessions] = await pool.execute(
                'SELECT id, status FROM payment_sessions WHERE session_id = ?',
                [session.id]
            );
            
            if (existingSessions.length > 0 && existingSessions[0].status === 'completed') {
                console.log('WEBHOOK: Payment session already processed, skipping:', session.id);
                return res.json({ 
                    received: true, 
                    success: true,
                    message: 'Payment session already processed successfully',
                    status: 'already_completed' 
                });
            }
            
            //  Use database transaction for atomicity RACE CONDITION SCAYRYYRYR
            const connection = await pool.getConnection();
            await connection.beginTransaction();
            
            try {
                // Extract booking data from session metadata
                const bookingData = JSON.parse(session.metadata.booking_data);
                const bookingId = session.metadata.booking_id || `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                //  Check if booking already exists (either confirmed or pending)
                const [existingBookings] = await connection.execute(
                    'SELECT id, booking_status FROM bookings WHERE payment_reference = ? OR id = ?',
                    [session.payment_intent, bookingId]
                );
                
                if (existingBookings.length > 0) {
                    const existingBooking = existingBookings[0];
                    
                    if (existingBooking.booking_status === 'confirmed') {
                        console.log('WEBHOOK: Booking already confirmed for payment:', session.payment_intent);
                        await connection.rollback();
                        connection.release();
                        return res.json({ 
                            received: true, 
                            success: true,
                            message: 'Booking already confirmed for this payment',
                            status: 'already_confirmed',
                            bookingId: existingBooking.id
                        });
                    } else if (existingBooking.booking_status === 'pending') {
                        // Update existing pending booking to confirmed
                        console.log('WEBHOOK: Updating pending booking to confirmed:', existingBooking.id);
                        
                        const updateResult = await connection.execute(
                            'UPDATE bookings SET booking_status = "confirmed", payment_reference = ?, updated_at = NOW() WHERE id = ?',
                            [session.payment_intent, existingBooking.id]
                        );
                        
                        console.log('WEBHOOK: Booking status updated to confirmed for:', existingBooking.id);
                        
                        // Update payment session status
                        const sessionUpdateResult = await connection.execute(
                            'UPDATE payment_sessions SET status = "completed", transaction_id = ?, updated_at = NOW() WHERE session_id = ?',
                            [session.payment_intent, session.id]
                        );
                        
                        await connection.commit();
                        connection.release();
                        
                        console.log('WEBHOOK: Successfully updated existing booking to confirmed:', existingBooking.id);
                        
                        return res.json({ 
                            received: true, 
                            success: true,
                            message: 'Existing pending booking updated to confirmed status',
                            data: {
                                bookingId: existingBooking.id,
                                status: 'confirmed',
                                action: 'status_updated'
                            }
                        });
                    }
                }
                
                // Create the booking with the predetermined ID
                const newBookingId = bookingId;
                const bookingResult = await connection.execute(`
                    INSERT INTO bookings (
                        id, hotel_id, start_date, end_date, nights, adults, children,
                        message_to_hotel, room_types, total_price, currency, first_name, last_name, phone, email,
                        payment_reference, booking_status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', NOW(), NOW())
                `, [
                    newBookingId,
                    bookingData.hotel_id,
                    bookingData.start_date,
                    bookingData.end_date,
                    bookingData.nights,
                    bookingData.adults || 1,
                    bookingData.children || 0,
                    bookingData.special_requests || null,
                    JSON.stringify([bookingData.room_type]),
                    bookingData.total_price,
                    bookingData.currency,
                    bookingData.first_name,
                    bookingData.last_name,
                    bookingData.phone,
                    bookingData.email,
                    session.payment_intent
                ]);
                
                console.log('WEBHOOK: New booking created successfully:', newBookingId);
                
                // Update payment session status
                const sessionUpdateResult = await connection.execute(
                    'UPDATE payment_sessions SET status = "completed", transaction_id = ?, updated_at = NOW() WHERE session_id = ?',
                    [session.payment_intent, session.id]
                );
                
                console.log('WEBHOOK: Payment session updated successfully');
                
                await connection.commit();
                connection.release();
                
                console.log('WEBHOOK: Booking auto-saved successfully via webhook:', newBookingId);
                
                // Return detailed success response
                return res.json({ 
                    received: true, 
                    success: true,
                    message: 'Booking successfully saved to database via webhook',
                    data: {
                        bookingId: newBookingId,
                        status: 'confirmed'
                    }
                });
                
            } catch (transactionError) {
                await connection.rollback();
                connection.release();
                throw transactionError;
            }
            
        } catch (error) {
            console.error('WEBHOOK: Error saving booking via webhook:', error.message);
            return res.status(500).json({ 
                received: true, 
                success: false,
                message: 'Failed to save booking to database'
            });
        }
    }
    
    // For other event types or unhandled cases
    res.json({ 
        received: true, 
        message: 'Webhook received but no action taken',
        eventType: event.type 
    });
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
        
        console.log('Booking saved successfully:', newBooking.id);
        
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
        console.error('ERROR: Failed to confirm payment:', error.message);
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
        console.log('Request body:', req.body);
        
        // Map frontend field names to backend field names
        const bookingData = {
            // Hotel info
            hotel_id: req.body.hotel_id || req.body.hotelId,
            hotel_name: req.body.hotel_name || req.body.hotelName || req.body.name,
            
            // Dates - handle frontend field names
            start_date: req.body.start_date || req.body.checkIn || req.body.checkInDate,
            end_date: req.body.end_date || req.body.checkOut || req.body.checkOutDate,
            nights: req.body.nights || req.body.numberOfNights,
            
            // Guests
            adults: req.body.adults || req.body.numberOfGuests || req.body.guests || 1,
            children: req.body.children || 0,
            
            // Room and pricing
            room_type: req.body.room_type || req.body.roomType || req.body.room,
            room_types: req.body.room_types || req.body.roomTypes || [req.body.room_type || req.body.roomType || req.body.room || 'Standard Room'],
            total_price: req.body.total_price || req.body.totalAmount || req.body.price,
            currency: req.body.currency || 'SGD',
            
            // Guest info - handle frontend field names
            first_name: req.body.first_name || req.body.firstName || req.body.guestName?.split(' ')[0],
            last_name: req.body.last_name || req.body.lastName || req.body.guestName?.split(' ').slice(1).join(' '),
            phone: req.body.phone,
            email: userEmail,
            
            // Optional fields
            special_requests: req.body.special_requests || req.body.specialRequests
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
                        unit_amount: (['JPY', 'KRW'].includes(bookingData.currency?.toUpperCase())) 
                            ? Math.round(bookingData.total_price) // Zero-decimal currencies: use amount as-is
                            : Math.round(bookingData.total_price * 100), // Other currencies: convert to cents
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
        
        // Parse JSON fields that were stored as strings
        let parsedRoomTypes;
        try {
            if (typeof booking.room_types === 'string') {
                parsedRoomTypes = JSON.parse(booking.room_types);
            } else if (Array.isArray(booking.room_types)) {
                parsedRoomTypes = booking.room_types;
            } else {
                parsedRoomTypes = [];
            }
        } catch (e) {
            console.warn('Failed to parse room_types JSON, using fallback:', booking.room_types);
            parsedRoomTypes = ['Standard Room']; // Provide a default value instead of empty
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
                roomTypes: parsedRoomTypes,
                totalPrice: parseFloat(booking.total_price),
                currency: booking.currency,
                status: booking.booking_status,
                specialRequests: booking.message_to_hotel,
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

// Public endpoint to find booking by ID (no authentication required)
// This creates a separate router for public access
const publicRouter = express.Router();

publicRouter.get('/find/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;
        
        console.log(`Public booking search for ID: ${bookingId}`);
        
        // Use BookingModel for consistency
        const booking = await BookingModel.findById(bookingId);
        
        if (!booking) {
            console.log(`Public search: Booking not found for ID: ${bookingId}`);
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        
        console.log(`Public search: Booking found for ID: ${bookingId}`);
        
        // Parse JSON fields that were stored as strings
        let parsedRoomTypes;
        try {
            if (typeof booking.room_types === 'string') {
                parsedRoomTypes = JSON.parse(booking.room_types);
            } else if (Array.isArray(booking.room_types)) {
                parsedRoomTypes = booking.room_types;
            } else {
                parsedRoomTypes = [];
            }
        } catch (e) {
            console.warn('Failed to parse room_types JSON, using fallback:', booking.room_types);
            parsedRoomTypes = ['Standard Room']; // Provide a default value instead of empty
        }

        // Return comprehensive booking information
        res.status(200).json({
            success: true,
            data: {
                id: booking.id,
                hotel_id: booking.hotel_id,
                start_date: booking.start_date,
                end_date: booking.end_date,
                nights: booking.nights,
                adults: booking.adults,
                children: booking.children,
                room_types: parsedRoomTypes,
                total_price: booking.total_price,
                currency: booking.currency,
                first_name: booking.first_name,
                last_name: booking.last_name,
                phone: booking.phone,
                email: booking.email,
                payment_reference: booking.payment_reference,
                booking_status: booking.booking_status,
                special_requests: booking.special_requests || booking.message_to_hotel,
                created_at: booking.created_at,
                updated_at: booking.updated_at
            }
        });
        
    } catch (error) {
        console.error('Error in public booking search:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to find booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

export default { 
    router,
    webhookRouter,
    publicRouter 
};