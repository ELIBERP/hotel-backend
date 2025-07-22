import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import hotelRouter from '../../controller/hotel.js';
import hotel from '../../model/hotel.js';

// Mock the model for integration test
jest.mock('../../model/hotel.js', () => ({
  findRoomsByID: jest.fn()
}));

const app = express();
app.use(express.json());
app.use('/hotels', hotelRouter.router);

describe('GET /hotels/:id/prices', () => {
  
  it('should return 200 and rooms data when rooms are available', async () => {
    const mockRoomsData = {
      completed: true,
      rooms: [{ roomDescription: 'Mock Room' }]
    };

    hotel.findRoomsByID.mockResolvedValueOnce(mockRoomsData);

    const res = await request(app)
      .get('/hotels/test-hotel-id/prices')
      .query({ guests: 2 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(mockRoomsData);
    expect(hotel.findRoomsByID).toHaveBeenCalledWith(
      'test-hotel-id',
      expect.objectContaining({ guests: '2' })
    );
  });

  it('should return 200 and empty rooms data when no rooms are available', async () => {
    const mockEmptyRoomsData = {
      completed: false,
      rooms: []
    };

    hotel.findRoomsByID.mockResolvedValueOnce(mockEmptyRoomsData);

    const res = await request(app)
      .get('/hotels/test-hotel-id/prices')
      .query({ guests: 2 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(mockEmptyRoomsData);
    expect(hotel.findRoomsByID).toHaveBeenCalledWith(
      'test-hotel-id',
      expect.objectContaining({ guests: '2' })
    );
  });

  it('should propagate errors properly', async () => {
    hotel.findRoomsByID.mockRejectedValueOnce(new Error('API failure'));

    const res = await request(app)
      .get('/hotels/test-hotel-id/prices')
      .query({ guests: 2 });

    // Assuming your error middleware sends 500 on unhandled errors:
    expect(res.statusCode).toBe(500);
  });
});
