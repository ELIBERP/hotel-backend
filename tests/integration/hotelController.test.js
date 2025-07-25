import { jest } from '@jest/globals';
import hotel from '../../model/hotel.js';

describe('Integration: hotel.findRoomsByID', () => {
  // Increase timeout if API is slow or polling takes time
  jest.setTimeout(15000);

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

    const data = await hotel.findRoomsByID(realHotelId, query);

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

  const data = await hotel.findRoomsByID('invalid-id-12345', query);

  expect(data).toHaveProperty('completed', true);
  expect(Array.isArray(data.rooms)).toBe(true);
  expect(data.rooms.length).toBe(0);
});
});
