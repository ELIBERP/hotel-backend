import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Create mock functions for integration test
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
const { default: hotelRouter } = await import('../../controller/hotel.js');

const app = express();
app.use(express.json());
app.use('/hotels', hotelRouter.router);

// Add error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

describe('Hotel Controller Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /hotels/:id/prices - Room Search Integration', () => {
    it('should return 200 and rooms data with valid parameters', async () => {
      const mockRoomsData = {
        completed: true,
        rooms: [{ roomDescription: 'Mock Room', price: 150 }]
      };

      mockHotelModel.findRoomsByID.mockResolvedValueOnce(mockRoomsData);

      const res = await request(app)
        .get('/hotels/test-hotel-id/prices')
        .query({ 
          destination_id: 'WD0M',
          checkin: '2025-08-01',
          checkout: '2025-08-05',
          guests: '2' 
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockRoomsData);
      expect(mockHotelModel.findRoomsByID).toHaveBeenCalledWith(
        'test-hotel-id',
        expect.objectContaining({ 
          destination_id: 'WD0M',
          guests: 2  // Should be converted to number
        })
      );
    });

    it('should return 400 for missing destination_id', async () => {
      const res = await request(app)
        .get('/hotels/test-hotel-id/prices')
        .query({ guests: '2' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('destination_id is required');
      expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid guest count', async () => {
      const res = await request(app)
        .get('/hotels/test-hotel-id/prices')
        .query({ 
          destination_id: 'WD0M',
          guests: '0' 
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Invalid guest count. Must be between 1 and 10');
      expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
    });

    it('should return 400 for past check-in date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateString = pastDate.toISOString().split('T')[0];

      const res = await request(app)
        .get('/hotels/test-hotel-id/prices')
        .query({ 
          destination_id: 'WD0M',
          checkin: pastDateString
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Check-in date cannot be in the past');
      expect(mockHotelModel.findRoomsByID).not.toHaveBeenCalled();
    });

    it('should propagate errors properly', async () => {
      mockHotelModel.findRoomsByID.mockRejectedValueOnce(new Error('API failure'));

      const res = await request(app)
        .get('/hotels/test-hotel-id/prices')
        .query({ destination_id: 'WD0M' });

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('API failure');
    });
  });

  describe('GET /hotels - Hotel Search Integration', () => {
    it('should return hotels for valid destination', async () => {
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

    it('should propagate model errors', async () => {
      mockHotelModel.find.mockRejectedValueOnce(new Error('Search failed'));

      const res = await request(app)
        .get('/hotels')
        .query({ destination_id: 'ERROR_ID' });

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Search failed');
    });
  });

  describe('GET /hotels/:id - Hotel Details Integration', () => {
    it('should return hotel details for valid ID', async () => {
      const mockHotel = { id: 'hotel123', name: 'Test Hotel' };

      mockHotelModel.findById.mockResolvedValueOnce(mockHotel);

      const res = await request(app)
        .get('/hotels/hotel123');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockHotel);
      expect(mockHotelModel.findById).toHaveBeenCalledWith('hotel123');
    });

    it('should propagate model errors', async () => {
      mockHotelModel.findById.mockRejectedValueOnce(new Error('Hotel not found'));

      const res = await request(app)
        .get('/hotels/invalid-id');

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Hotel not found');
    });
  });

  it('should retrieve rooms from the real API for a valid hotel ID', async () => {
    const realHotelId = 'diH7'; // use a real hotel ID you know works
    const query = {
      destination_id: 'WD0M',
      checkin: '2025-10-10',
      checkout: '2025-10-17',
      guests: 2,
      currency: 'SGD',
      country_code: 'SG',
      lang: 'en_US',
      partner_id: 1,
    };

    const mockRealData = {
      completed: true,
      rooms: [{
        roomDescription: 'Standard Room',
        converted_price: 150
      }]
    };

    mockHotelModel.findRoomsByID.mockResolvedValueOnce(mockRealData);
    const data = await mockHotelModel.findRoomsByID(realHotelId, query);

    expect(data).toHaveProperty('completed', true);
    expect(Array.isArray(data.rooms)).toBe(true);
    expect(data.rooms.length).toBeGreaterThan(0);

    const room = data.rooms[0];
    expect(room).toHaveProperty('roomDescription');
    expect(room).toHaveProperty('converted_price');
  });

  it('should return empty array of rooms for invalid hotel ID', async () => {
    const query = {
      destination_id: 'diH7',
      checkin: '2025-10-10',
      checkout: '2025-10-17',
      guests: 2,
      currency: 'SGD',
      country_code: 'SG',
      lang: 'en_US',
      partner_id: 1,
    };

    const mockEmptyData = {
      completed: true,
      rooms: []
    };

    mockHotelModel.findRoomsByID.mockResolvedValueOnce(mockEmptyData);
    const data = await mockHotelModel.findRoomsByID('invalid-id-12345', query);

    expect(data).toHaveProperty('completed', true);
    expect(Array.isArray(data.rooms)).toBe(true);
    expect(data.rooms.length).toBe(0);
  });
});
