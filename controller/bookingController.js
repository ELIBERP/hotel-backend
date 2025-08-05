import express from 'express';
import { verifyToken } from '../middleware/auth.js';

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
        
        // For now, return mock data
        const mockBookings = [
            {
                id: "booking-123",
                userId: userId,
                hotelId: "hotel-456",
                hotelName: "Grand Hotel Singapore",
                checkIn: "2025-08-15",
                checkOut: "2025-08-18",
                nights: 3,
                guests: 2,
                totalPrice: 450.00,
                currency: "SGD",
                status: "confirmed",
                createdAt: "2025-08-01T10:30:00Z"
            }
        ];
        
        res.status(200).json({
            success: true,
            message: `Found ${mockBookings.length} bookings for user ${userId}`,
            bookings: mockBookings
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

// POST /bookings - Create new booking (Protected Route)
router.post('/', async (req, res) => {
    try {
        // User info from JWT token
        const userId = res.locals.userId;
        const userEmail = res.locals.email;
        
        console.log(`Creating booking for user: ${userId} (${userEmail})`);
        
        const { hotelId, checkIn, checkOut, guests, roomType, totalPrice } = req.body;
        
        // Validate required fields
        if (!hotelId || !checkIn || !checkOut || !guests) {
            return res.status(400).json({
                success: false,
                message: 'Missing required booking information',
                errors: ['hotelId, checkIn, checkOut, and guests are required']
            });
        }
        
        // Mock response
        const mockBooking = {
            id: `booking-${Date.now()}`,
            userId: userId,
            hotelId,
            checkIn,
            checkOut,
            guests,
            roomType: roomType || 'Standard Room',
            totalPrice: totalPrice || 150,
            currency: 'SGD',
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            booking: mockBooking
        });
        
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create booking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

export default { router };