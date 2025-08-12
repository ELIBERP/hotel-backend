// routes/payment.js
import express from 'express';
import stripe from '../config/stripe.js';

const router = express.Router();

// Create checkout session for hotel booking
router.post('/create-checkout-session', async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(500).json({ 
        error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables.' 
      });
    }

    const { 
      hotelName, 
      roomType, 
      checkInDate, 
      checkOutDate, 
      numberOfGuests, 
      pricePerNight, 
      numberOfNights,
      totalAmount, // Use specified total amount directly
      bookingId, // Add your booking ID from database
      currency = 'usd' 
    } = req.body;

    // Validate required fields
    if (!hotelName || !roomType || !checkInDate || !checkOutDate || !totalAmount) {
      return res.status(400).json({ error: 'Missing required booking details' });
    }

    // Use the specified total amount directly (convert to cents for Stripe)
    const amountInCents = Math.round(totalAmount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: currency,
          product_data: {
            name: `${hotelName} - ${roomType}`,
            description: `${numberOfNights} night(s) stay from ${checkInDate} to ${checkOutDate} for ${numberOfGuests} guest(s)`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/booking-cancel`,
      metadata: {
        booking_id: bookingId,
        hotel_name: hotelName,
        room_type: roomType,
        check_in: checkInDate,
        check_out: checkOutDate,
        guests: numberOfGuests.toString(),
        nights: numberOfNights.toString(),
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get booking details after payment
router.get('/booking-details/:sessionId', async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(500).json({ 
        error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables.' 
      });
    }

    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    
    if (session.payment_status === 'paid') {
      res.json({
        success: true,
        booking: {
          bookingId: session.metadata.booking_id,
          hotelName: session.metadata.hotel_name,
          roomType: session.metadata.room_type,
          checkIn: session.metadata.check_in,
          checkOut: session.metadata.check_out,
          guests: session.metadata.guests,
          nights: session.metadata.nights,
          totalAmount: session.amount_total / 100,
          currency: session.currency,
          paymentIntent: session.payment_intent,
        }
      });
    } else {
      res.json({ success: false, message: 'Payment not completed' });
    }
  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
