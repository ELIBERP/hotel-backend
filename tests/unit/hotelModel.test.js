import hotel from '../../model/hotel.js';
import { jest } from '@jest/globals';

// Mock `fetch` globally:
global.fetch = jest.fn();

describe('Hotel Model Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hotel.find - Search by Destination', () => {
    it('should return hotels when valid destination_id is provided', async () => {
      const mockHotels = [
        { id: 'hotel1', name: 'Test Hotel 1' },
        { id: 'hotel2', name: 'Test Hotel 2' }
      ];

      fetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockHotels),
      });

      const result = await hotel.find('WD0M');

      expect(fetch).toHaveBeenCalledWith(
        'https://hotelapi.loyalty.dev/api/hotels?destination_id=WD0M',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual(mockHotels);
    });

    it('should return Error object when API responds with non-200 status', async () => {
      fetch.mockResolvedValueOnce({
        status: 404,
        json: jest.fn(),
      });

      const result = await hotel.find('INVALID');

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('HTTP error! status: 404');
    });

    it('should handle undefined destination_id gracefully', async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue([]),
      });

      const result = await hotel.find(undefined);

      expect(fetch).toHaveBeenCalledWith(
        'https://hotelapi.loyalty.dev/api/hotels?destination_id=undefined',
        expect.any(Object)
      );
      expect(result).toEqual([]);
    });
  });

  describe('hotel.findById - Get Hotel by ID', () => {
    it('should return hotel data when valid hotel ID is provided', async () => {
      const mockHotel = { id: 'hotel123', name: 'Test Hotel', location: 'Test City' };

      fetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockHotel),
      });

      const result = await hotel.findById('hotel123');

      expect(fetch).toHaveBeenCalledWith('https://hotelapi.loyalty.dev/api/hotels/hotel123');
      expect(result).toEqual(mockHotel);
    });

    it('should throw error when API responds with non-200 status', async () => {
      fetch.mockResolvedValueOnce({
        status: 404,
        json: jest.fn(),
      });

      await expect(hotel.findById('invalid-hotel-id'))
        .rejects
        .toThrow('HTTP error! status: 404');
    });
  });

  describe('hotel.findRoomsByID - Search Rooms with Date and Guest Validation', () => {
    it('should return room data when API responds with completed=true immediately', async () => {
      const mockRoomData = {
        completed: true,
        rooms: [
          { 
            roomDescription: 'Deluxe Room',
            price: 150,
            currency: 'USD'
          }
        ]
      };

      fetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockRoomData),
      });

      const query = {
        destination_id: 'WD0M',
        checkin: '2025-08-01',
        checkout: '2025-08-05',
        guests: 2
      };

      const result = await hotel.findRoomsByID('hotel123', query);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        'https://hotelapi.loyalty.dev/api/hotels/hotel123/price?destination_id=WD0M&checkin=2025-08-01&checkout=2025-08-05&guests=2'
      );
      expect(result).toEqual(mockRoomData);
    });

    it('should poll until completed=true and return final data', async () => {
      const mockIncompleteResponse = {
        completed: false,
        message: 'Processing...'
      };
      
      const mockCompleteResponse = {
        completed: true,
        rooms: [{ roomDescription: 'Standard Room', price: 100 }]
      };

      // First call returns incomplete, second call returns complete
      fetch
        .mockResolvedValueOnce({
          status: 200,
          json: jest.fn().mockResolvedValue(mockIncompleteResponse),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: jest.fn().mockResolvedValue(mockCompleteResponse),
        });

      // Mock setTimeout to avoid actual delay in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return 'mock-timeout-id';
      });

      const query = { destination_id: 'WD0M', guests: 1 };
      const result = await hotel.findRoomsByID('hotel123', query);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockCompleteResponse);
      
      // Restore setTimeout
      global.setTimeout.mockRestore();
    });

    it('should throw error when API responds with non-200 status', async () => {
      fetch.mockResolvedValueOnce({
        status: 500,
        json: jest.fn(),
      });

      const query = { destination_id: 'WD0M', guests: 2 };

      await expect(hotel.findRoomsByID('hotel123', query))
        .rejects
        .toThrow('HTTP error! status: 500');
    });

    it('should handle query parameters correctly including guest count conversion', async () => {
      const mockRoomData = { completed: true, rooms: [] };

      fetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockRoomData),
      });

      const query = {
        destination_id: 'WD0M',
        checkin: '2025-08-01',
        checkout: '2025-08-05',
        guests: 4,
        currency: 'EUR',
        lang: 'en'
      };

      await hotel.findRoomsByID('hotel123', query);

      expect(fetch).toHaveBeenCalledWith(
        'https://hotelapi.loyalty.dev/api/hotels/hotel123/price?destination_id=WD0M&checkin=2025-08-01&checkout=2025-08-05&guests=4&currency=EUR&lang=en'
      );
    });

    it('should handle empty query object gracefully', async () => {
      const mockRoomData = { completed: true, rooms: [] };

      fetch.mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(mockRoomData),
      });

      await hotel.findRoomsByID('hotel123', {});

      expect(fetch).toHaveBeenCalledWith(
        'https://hotelapi.loyalty.dev/api/hotels/hotel123/price?'
      );
    });
  });
});
