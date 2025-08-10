import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Create mock functions
const mockHotelModel = {
  find: jest.fn(),
  findById: jest.fn(),
  findRoomsByID: jest.fn()
};

// Mock the cache middleware to avoid cache-related issues
const mockCacheMiddleware = jest.fn(() => (req, res, next) => next());

// Mock modules BEFORE importing controller
jest.unstable_mockModule('../../model/hotel.js', () => ({
  default: mockHotelModel
}));

jest.unstable_mockModule('../../middleware/cache.js', () => ({
  cacheMiddleware: mockCacheMiddleware
}));

// Use dynamic import for the controller
const { default: hotelController } = await import('../../controller/hotel.js');

const app = express();
app.use(express.json());
app.use('/hotels', hotelController.router);

// Add error handling middleware for testing
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

describe('Hotel Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /hotels - Search by Destination', () => {
    it('should return hotels when valid destination_id is provided', async () => {
      const mockHotels = [
        { id: 'hotel1', name: 'Test Hotel 1' },
        { id: 'hotel2', name: 'Test Hotel 2' }
      ];

      mockHotelModel.find.mockResolvedValueOnce(mockHotels);

      const res = await request(app)
        .get('/hotels')
        .query({ destination_id: 'WD0M' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockHotels);
      expect(mockHotelModel.find).toHaveBeenCalledWith('WD0M');
    });

    it('should handle empty results gracefully', async () => {
      mockHotelModel.find.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/hotels')
        .query({ destination_id: 'NONEXISTENT' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
      expect(mockHotelModel.find).toHaveBeenCalledWith('NONEXISTENT');
    });

    it('should forward errors from model to error middleware', async () => {
      const mockError = new Error('API failure');
      mockHotelModel.find.mockRejectedValueOnce(mockError);

      const res = await request(app)
        .get('/hotels')
        .query({ destination_id: 'ERROR_ID' });

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('API failure');
    });

    it('should handle missing destination_id parameter', async () => {
      mockHotelModel.find.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/hotels');

      expect(res.statusCode).toBe(200);
      expect(mockHotelModel.find).toHaveBeenCalledWith(undefined);
    });
  });

  describe('GET /hotels/:id - Get Hotel by ID', () => {
    it('should return hotel data when valid hotel ID is provided', async () => {
      const mockHotel = { id: 'hotel123', name: 'Test Hotel' };

      mockHotelModel.findById.mockResolvedValueOnce(mockHotel);

      const res = await request(app)
        .get('/hotels/hotel123');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockHotel);
      expect(mockHotelModel.findById).toHaveBeenCalledWith('hotel123');
    });

    it('should forward errors from model to error middleware', async () => {
      const mockError = new Error('Hotel not found');
      mockHotelModel.findById.mockRejectedValueOnce(mockError);

      const res = await request(app)
        .get('/hotels/invalid-id');

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Hotel not found');
    });
  });

  describe('GET /hotels/:id/prices - Search Rooms with Validation', () => {
    describe('Successful searches', () => {
      it('should return room data with valid parameters', async () => {
        const mockRoomsData = {
            completed: true,
            rooms: [{ roomDescription: 'Deluxe Room', price: 150 }]
        };

        mockHotelModel.findRoomsByID.mockResolvedValueOnce(mockRoomsData);

        // Use dynamic future dates
        const checkinDate = new Date();
        checkinDate.setDate(checkinDate.getDate() + 1); // Tomorrow
        const checkoutDate = new Date();
        checkoutDate.setDate(checkoutDate.getDate() + 5); // 5 days from now

        const res = await request(app)
            .get('/hotels/hotel123/prices')
            .query({
                destination_id: 'WD0M',
                checkin: checkinDate.toISOString().split('T')[0],
                checkout: checkoutDate.toISOString().split('T')[0],
                guests: '2'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(mockRoomsData);
        expect(mockHotelModel.findRoomsByID).toHaveBeenCalledWith('hotel123', {
            destination_id: 'WD0M',
            checkin: checkinDate.toISOString().split('T')[0],
            checkout: checkoutDate.toISOString().split('T')[0],
            guests: 2, // Should be converted to number
            lang: undefined,
            currency: undefined,
            country_code: undefined,
            partner_id: undefined
        });
      });

      it('should use default guest count when not provided', async () => {
        const mockRoomsData = { completed: true, rooms: [] };
        mockHotelModel.findRoomsByID.mockResolvedValueOnce(mockRoomsData);

        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({ destination_id: 'WD0M' });

        expect(res.statusCode).toBe(200);
        expect(mockHotelModel.findRoomsByID).toHaveBeenCalledWith('hotel123', 
          expect.objectContaining({ guests: 2 })
        );
      });
    });

    describe('Destination ID validation', () => {
      it('should reject requests without destination_id', async () => {
        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            checkin: '2025-08-01',
            checkout: '2025-08-05'
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('destination_id is required');
        expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
      });
    });

    describe('Date validation', () => {
      it('should reject past check-in dates', async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        const pastDateString = pastDate.toISOString().split('T')[0];

        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            checkin: pastDateString
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Check-in date cannot be in the past');
        expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
      });

      it('should reject invalid check-in date format', async () => {
        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            checkin: 'invalid-date'
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Invalid checkin date format');
        expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
      });

      it('should reject invalid check-out date format', async () => {
        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            checkout: 'invalid-date'
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Invalid checkout date format');
        expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
      });

      it('should reject check-out date before check-in date', async () => {
        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            checkin: '2025-08-05',
            checkout: '2025-08-01'
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Check-in date cannot be in the past');
        expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
      });

      it('should reject check-out date equal to check-in date', async () => {
        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            checkin: '2025-08-01',
            checkout: '2025-08-01'
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Check-in date cannot be in the past');
        expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
      });

      it('should accept valid future dates', async () => {
        const mockRoomsData = { completed: true, rooms: [] };
        mockHotelModel.findRoomsByID.mockResolvedValueOnce(mockRoomsData);

        const futureDate1 = new Date();
        futureDate1.setDate(futureDate1.getDate() + 30);
        const futureDate2 = new Date();
        futureDate2.setDate(futureDate2.getDate() + 35);

        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            checkin: futureDate1.toISOString().split('T')[0],
            checkout: futureDate2.toISOString().split('T')[0]
          });

        expect(res.statusCode).toBe(200);
        expect(mockHotelModel.findRoomsByID).toHaveBeenCalled();
      });

      it('should handle missing checkin when checkout is provided', async () => {
        const mockRoomsData = { completed: true, rooms: [] };
        mockHotelModel.findRoomsByID.mockResolvedValueOnce(mockRoomsData);

        const res = await request(app)
            .get('/hotels/hotel123/prices')
            .query({
                destination_id: 'WD0M',
                // checkin missing/ undefined
                checkout: '2025-08-15', // checkout present
                guests: '2'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(mockRoomsData);
        expect(mockHotelModel.findRoomsByID).toHaveBeenCalled();
      });
    });

    describe('Guest count validation', () => {
      it('should reject guest count of 0', async () => {
        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            guests: '0'
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Invalid guest count. Must be between 1 and 10');
        expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
      });

      it('should reject guest count greater than 10', async () => {
        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            guests: '11'
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Invalid guest count. Must be between 1 and 10');
        expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
      });

      it('should reject non-numeric guest count', async () => {
        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            guests: 'abc'
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Invalid guest count. Must be between 1 and 10');
        expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
      });

      it('should convert valid string guest count to number', async () => {
        const mockRoomsData = { completed: true, rooms: [] };
        mockHotelModel.findRoomsByID.mockResolvedValueOnce(mockRoomsData);

        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({
            destination_id: 'WD0M',
            guests: '5'
          });

        expect(res.statusCode).toBe(200);
        expect(mockHotelModel.findRoomsByID).toHaveBeenCalledWith('hotel123', 
          expect.objectContaining({ guests: 5 })
        );
      });

      it('should accept valid guest counts from 1 to 10', async () => {
        const mockRoomsData = { completed: true, rooms: [] };
        mockHotelModel.findRoomsByID.mockResolvedValue(mockRoomsData);

        for (let guests = 1; guests <= 10; guests++) {
          const res = await request(app)
            .get('/hotels/hotel123/prices')
            .query({
              destination_id: 'WD0M',
              guests: guests.toString()
            });

          expect(res.statusCode).toBe(200);
        }

        expect(mockHotelModel.findRoomsByID).toHaveBeenCalledTimes(10);
      });
    });

    describe('Error handling', () => {
      it('should forward errors from model to error middleware', async () => {
        const mockError = new Error('API failure');
        mockHotelModel.findRoomsByID.mockRejectedValueOnce(mockError);

        const res = await request(app)
          .get('/hotels/hotel123/prices')
          .query({ destination_id: 'WD0M' });

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('API failure');
      });
    });
  });
});
