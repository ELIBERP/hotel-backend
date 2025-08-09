import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import BookingModel from '../model/booking.js';
import stripe from '../config/stripe.js';

const router = express.Router();

// All booking routes require authentication
router.use(verifyToken);

// GET /bookings - Get user's bookings (Protected Route)
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

export default { router };