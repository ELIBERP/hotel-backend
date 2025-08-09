// routes/booking.js
import express from 'express';
const router = express.Router();

// In-memory storage for demo (replace with actual database)
let bookings = [];

// Create a new booking
router.post('/', async (req, res) => {
  try {
    const { bookingId, guestInfo, bookingDetails, status } = req.body;

    // Validate required fields
    if (!bookingId || !guestInfo || !bookingDetails) {
      return res.status(400).json({
        error: 'Missing required fields: bookingId, guestInfo, bookingDetails'
      });
    }

    // Validate guest information
    const requiredGuestFields = ['firstName', 'lastName', 'email', 'phoneNumber'];
    for (const field of requiredGuestFields) {
      if (!guestInfo[field]) {
        return res.status(400).json({
          error: `Missing required guest information: ${field}`
        });
      }
    }

    // Check if booking already exists
    const existingBooking = bookings.find(b => b.bookingId === bookingId);
    if (existingBooking) {
      return res.status(409).json({
        error: 'Booking with this ID already exists'
      });
    }

    // Create booking object with security considerations
    const newBooking = {
      bookingId,
      guestInfo: {
        firstName: guestInfo.firstName.trim(),
        lastName: guestInfo.lastName.trim(),
        email: guestInfo.email.toLowerCase().trim(),
        phoneNumber: guestInfo.phoneNumber.trim(),
        specialRequests: guestInfo.specialRequests ? guestInfo.specialRequests.trim() : null
      },
      bookingDetails: {
        hotelName: bookingDetails.hotelName,
        roomType: bookingDetails.roomType,
        checkInDate: bookingDetails.checkInDate,
        checkOutDate: bookingDetails.checkOutDate,
        numberOfGuests: parseInt(bookingDetails.numberOfGuests),
        numberOfNights: parseInt(bookingDetails.numberOfNights),
        totalAmount: parseFloat(bookingDetails.totalAmount)
      },
      status: status || 'pending_payment',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store booking (in production, save to database)
    bookings.push(newBooking);

    console.log(`✅ Booking created: ${bookingId} for ${guestInfo.firstName} ${guestInfo.lastName}`);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: {
        bookingId: newBooking.bookingId,
        status: newBooking.status,
        totalAmount: newBooking.bookingDetails.totalAmount,
        guestName: `${newBooking.guestInfo.firstName} ${newBooking.guestInfo.lastName}`
      }
    });

  } catch (error) {
    console.error('❌ Error creating booking:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create booking'
    });
  }
});

// Get booking by ID
router.get('/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = bookings.find(b => b.bookingId === bookingId);
    
    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('❌ Error fetching booking:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Update booking status (for payment completion)
router.patch('/:bookingId/status', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, paymentDetails } = req.body;

    const bookingIndex = bookings.findIndex(b => b.bookingId === bookingId);
    
    if (bookingIndex === -1) {
      return res.status(404).json({
        error: 'Booking not found'
      });
    }

    // Update booking status
    bookings[bookingIndex].status = status;
    bookings[bookingIndex].updatedAt = new Date().toISOString();
    
    if (paymentDetails) {
      bookings[bookingIndex].paymentDetails = paymentDetails;
    }

    console.log(`✅ Booking status updated: ${bookingId} -> ${status}`);

    res.json({
      success: true,
      message: 'Booking status updated',
      booking: bookings[bookingIndex]
    });

  } catch (error) {
    console.error('❌ Error updating booking status:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get all bookings (admin endpoint - add authentication in production)
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings.map(booking => ({
        bookingId: booking.bookingId,
        guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName}`,
        hotelName: booking.bookingDetails.hotelName,
        checkInDate: booking.bookingDetails.checkInDate,
        totalAmount: booking.bookingDetails.totalAmount,
        status: booking.status,
        createdAt: booking.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;
