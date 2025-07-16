import hotel from '../../model/hotel.js';
import { jest } from '@jest/globals';


// Mock `fetch` globally:
global.fetch = jest.fn();

describe('hotel model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return room data when API responds with completed=true', async () => {
    const mockApiResponse = {
      completed: true,
      rooms: [{ roomDescription: 'Test Room' }]
    };

    // Setup fetch mock to return successful response
    fetch.mockResolvedValueOnce({
      status: 200,
      json: jest.fn().mockResolvedValue(mockApiResponse),
    });

    const result = await hotel.findRoomsByID('test-hotel-id', { guests: 2 });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockApiResponse);
  });

  it('should throw an error if response status !== 200', async () => {
    fetch.mockResolvedValueOnce({
      status: 404,
      json: jest.fn(),
    });

    await expect(hotel.findRoomsByID('invalid-id', {}))
      .rejects
      .toThrow('HTTP error! status: 404');
  });
});
