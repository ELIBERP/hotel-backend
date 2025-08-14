import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';

class BookingModel {
    // Create a new booking
    static async create(data) {
        try {
            const id = uuidv4();
            console.log('BookingModel: Creating booking with ID:', id);
            
            // Helper function to convert undefined to null
            const sanitize = (value) => value === undefined ? null : value;
            
            const query = `
                INSERT INTO bookings (
                    id, destination_id, hotel_id, start_date, end_date, nights, adults, children, 
                    message_to_hotel, room_types, total_price, currency, salutation, first_name, 
                    last_name, phone, email, payment_reference, masked_card_number, billing_address,
                    booking_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;
            
            const [result] = await pool.execute(query, [
                id,
                sanitize(data.destination_id),
                sanitize(data.hotel_id),
                sanitize(data.start_date),
                sanitize(data.end_date),
                sanitize(data.nights),
                sanitize(data.adults) || 1,
                sanitize(data.children) || 0,
                sanitize(data.special_requests || data.specialRequests),
                JSON.stringify(data.room_types || []),
                sanitize(data.total_price),
                sanitize(data.currency) || 'SGD',
                sanitize(data.salutation),
                sanitize(data.first_name),
                sanitize(data.last_name),
                sanitize(data.phone),
                sanitize(data.email),
                sanitize(data.payment_reference),
                sanitize(data.masked_card_number),
                JSON.stringify(data.billing_address || {}),
                sanitize(data.booking_status) || 'confirmed'  // Default to confirmed instead of pending
            ]);
            
            console.log('BookingModel: Booking created successfully with status:', data.booking_status || 'confirmed');
            return { id, ...data, booking_status: data.booking_status || 'confirmed', created_at: new Date() };
            
        } catch (error) {
            console.error('BookingModel create error:', error);
            throw new Error(`Failed to create booking: ${error.message}`);
        }
    }
    
    // Find booking by ID
    static async findById(id) {
        try {
            console.log('BookingModel: Finding booking by ID:', id);
            const query = 'SELECT * FROM bookings WHERE id = ?';
            const [rows] = await pool.execute(query, [id]);
            
            const booking = rows[0] || null;
            console.log('BookingModel: Booking found:', !!booking);
            
            return booking;
        } catch (error) {
            console.error('BookingModel findById error:', error);
            throw new Error(`Failed to find booking: ${error.message}`);
        }
    }
    
    // Find bookings by user email
    static async findByUserEmail(email) {
        try {
            console.log('BookingModel: Finding bookings for email:', email);
            const query = 'SELECT * FROM bookings WHERE email = ? ORDER BY created_at DESC';
            const [rows] = await pool.execute(query, [email]);
            
            console.log('BookingModel: Found', rows.length, 'bookings');
            return rows;
        } catch (error) {
            console.error('BookingModel findByUserEmail error:', error);
            throw new Error(`Failed to find bookings by email: ${error.message}`);
        }
    }
    
    // Update booking status
    static async updateStatus(id, status, paymentReference = null) {
        try {
            console.log('BookingModel: Updating booking status:', id, '→', status);
            let query = 'UPDATE bookings SET booking_status = ?, updated_at = NOW()';
            let params = [status];
            
            if (paymentReference) {
                query += ', payment_reference = ?';
                params.push(paymentReference);
            }
            
            query += ' WHERE id = ?';
            params.push(id);
            
            const [result] = await pool.execute(query, params);
            
            const success = result.affectedRows > 0;
            console.log('BookingModel: Status update result:', success);
            
            return success;
        } catch (error) {
            console.error('BookingModel updateStatus error:', error);
            throw new Error(`Failed to update booking status: ${error.message}`);
        }
    }
    
    // Get all bookings (admin function)
    static async findAll() {
        try {
            console.log('BookingModel: Getting all bookings');
            const query = 'SELECT * FROM bookings ORDER BY created_at DESC';
            const [rows] = await pool.execute(query);
            
            console.log('BookingModel: Found', rows.length, 'total bookings');
            return rows;
        } catch (error) {
            console.error('BookingModel findAll error:', error);
            throw new Error(`Failed to get all bookings: ${error.message}`);
        }
    }
    
    // Validate booking data (1.1.1: Validate Form Data from sequence diagram)
    static validateBookingData(data) {
        const errors = [];
        
        // Required fields validation - check both frontend and backend field names
        if (!data.hotel_id && !data.hotelId) errors.push('Hotel ID is required');
        if (!data.start_date && !data.checkIn && !data.checkInDate) errors.push('Check-in date is required');
        if (!data.end_date && !data.checkOut && !data.checkOutDate) errors.push('Check-out date is required');
        if (!data.first_name?.trim() && !data.firstName?.trim()) errors.push('First name is required');
        if (!data.last_name?.trim() && !data.lastName?.trim()) errors.push('Last name is required');
        if (!data.email?.trim()) errors.push('Email is required');
        if (!data.total_price && !data.price && !data.totalPrice && !data.totalAmount) errors.push('Valid total price is required');
        
        // Get actual values for validation
        const startDate = data.start_date || data.checkIn || data.checkInDate;
        const endDate = data.end_date || data.checkOut || data.checkOutDate;
        const totalPrice = data.total_price || data.price || data.totalPrice || data.totalAmount;
        
        // Date validation
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            console.log('Date validation debug:');
            console.log('- startDate input:', startDate);
            console.log('- start parsed:', start.toISOString());
            console.log('- today:', today.toISOString());
            console.log('- start < today:', start < today);
            
            if (start < today) {
                errors.push('Check-in date cannot be in the past');
            }
            
            if (end <= start) {
                errors.push('Check-out date must be after check-in date');
            }
        }
        
        // Email validation
        const email = data.email;
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Invalid email format');
        }
        
        // Price validation
        if (totalPrice && (totalPrice <= 0)) {
            errors.push('Total price must be greater than 0');
        }
        
        // Guest count validation
        const adults = data.adults || data.guests || data.numberOfGuests;
        if (adults && (adults < 1 || adults > 10)) {
            errors.push('Adults count must be between 1 and 10');
        }
        
        const children = data.children;
        if (children && (children < 0 || children > 10)) {
            errors.push('Children count must be between 0 and 10');
        }
        
        return errors;
    }
}

export default BookingModel;