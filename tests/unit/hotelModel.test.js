import hotel from '../../model/hotel.js';
import { jest } from '@jest/globals';

global.fetch = jest.fn();

describe('hotel.findRoomsByID', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve when first response is completed=true', async () => {
    const mockApiResponse = {
      completed: true,
      rooms: [{ roomDescription: 'Heritage Room Twin' }]
    };

    fetch.mockResolvedValueOnce({
      status: 200,
      json: jest.fn().mockResolvedValue(mockApiResponse)
    });

    const result = await hotel.findRoomsByID('test-hotel-id', { guests: 2 });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockApiResponse);
  });

  it('should poll until completed=true is received', async () => {
    const incompleteResponse = {
      completed: false,
      rooms: []
    };

    const completeResponse = {
      completed: true,
      rooms: [{ roomDescription: 'Quay Room' }]
    };

    fetch
      .mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(incompleteResponse)
      })
      .mockResolvedValueOnce({
        status: 200,
        json: jest.fn().mockResolvedValue(completeResponse)
      });

    const result = await hotel.findRoomsByID('test-hotel-id', { guests: 2 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual(completeResponse);
  });

  it('should throw an error if response is not 200', async () => {
    fetch.mockResolvedValueOnce({
      status: 500,
      json: jest.fn()
    });

    await expect(hotel.findRoomsByID('test-hotel-id', {})).rejects.toThrow('HTTP error! status: 500');
  });
});
