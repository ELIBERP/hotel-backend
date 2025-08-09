import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.js';

class BookingModel {
    // Create a new booking
    static async create(data) {
        try {
            const id = uuidv4();
            console.log('BookingModel: Creating booking with ID:', id);
            
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
                data.destination_id || null,
                data.hotel_id,
                data.start_date,
                data.end_date,
                data.nights,
                data.adults || 1,
                data.children || 0,
                data.message_to_hotel || null,
                JSON.stringify(data.room_types || []),
                data.total_price,
                data.currency || 'SGD',
                data.salutation || null,
                data.first_name,
                data.last_name,
                data.phone || null,
                data.email,
                data.payment_reference || null,
                data.masked_card_number || null,
                JSON.stringify(data.billing_address || {}),
                'pending'
            ]);
            
            console.log('BookingModel: Booking created successfully');
            return { id, ...data, booking_status: 'pending', created_at: new Date() };
            
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
        
        // Required fields validation
        if (!data.hotel_id) errors.push('Hotel ID is required');
        if (!data.start_date) errors.push('Check-in date is required');
        if (!data.end_date) errors.push('Check-out date is required');
        if (!data.first_name?.trim()) errors.push('First name is required');
        if (!data.last_name?.trim()) errors.push('Last name is required');
        if (!data.email?.trim()) errors.push('Email is required');
        if (!data.total_price || data.total_price <= 0) errors.push('Valid total price is required');
        
        // Date validation
        if (data.start_date && data.end_date) {
            const startDate = new Date(data.start_date);
            const endDate = new Date(data.end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (startDate < today) {
                errors.push('Check-in date cannot be in the past');
            }
            
            if (endDate <= startDate) {
                errors.push('Check-out date must be after check-in date');
            }
        }
        
        // Email validation
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Invalid email format');
        }
        
        // Guest count validation
        if (data.adults && (data.adults < 1 || data.adults > 10)) {
            errors.push('Adults count must be between 1 and 10');
        }
        
        if (data.children && (data.children < 0 || data.children > 10)) {
            errors.push('Children count must be between 0 and 10');
        }
        
        return errors;
    }
}

export default BookingModel;