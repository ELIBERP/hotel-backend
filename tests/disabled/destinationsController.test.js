import request from 'supertest';
import express from 'express';
import destinationsController from '../../controller/destinations.js';
import { jest } from '@jest/globals';

// Mock the destinations model
jest.mock('../../model/destinations.js', () => ({
  default: {
    search: jest.fn(),
    getById: jest.fn()
  }
}));

import destinations from '../../model/destinations.js';

const app = express();
app.use(express.json());
app.use('/destinations', destinationsController.router);

// Add error handling middleware for testing
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

describe('Destinations Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /destinations/search - Autocomplete Search', () => {
    it('should return suggestions for valid search query', async () => {
      const mockResults = [
        { uid: 'RsBU', term: 'London, England, United Kingdom', type: 'city' },
        { uid: 'test', term: 'London Airport', type: 'airport' }
      ];

      destinations.search.mockReturnValueOnce(mockResults);

      const res = await request(app)
        .get('/destinations/search')
        .query({ q: 'London' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockResults);
      expect(destinations.search).toHaveBeenCalledWith('London');
    });

    it('should return empty array for empty search query', async () => {
      destinations.search.mockReturnValueOnce([]);

      const res = await request(app)
        .get('/destinations/search')
        .query({ q: '' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
      expect(destinations.search).toHaveBeenCalledWith('');
    });

    it('should handle missing search query parameter', async () => {
      destinations.search.mockReturnValueOnce([]);

      const res = await request(app)
        .get('/destinations/search');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([]);
      expect(destinations.search).toHaveBeenCalledWith(undefined);
    });

    it('should sanitize and return results for queries with special characters', async () => {
      const mockResults = [
        { uid: 'iJrT', term: 'Paris, France', type: 'city' }
      ];

      destinations.search.mockReturnValueOnce(mockResults);

      const res = await request(app)
        .get('/destinations/search')
        .query({ q: '  Paris@#$  ' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockResults);
      expect(destinations.search).toHaveBeenCalledWith('  Paris@#$  ');
    });

    it('should forward errors from model to error middleware', async () => {
      const mockError = new Error('Search failed');
      destinations.search.mockImplementationOnce(() => {
        throw mockError;
      });

      const res = await request(app)
        .get('/destinations/search')
        .query({ q: 'test' });

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Search failed');
    });
  });

  describe('GET /destinations/:uid - Get Destination by UID', () => {
    it('should return destination when valid UID is provided', async () => {
      const mockDestination = {
        uid: 'WD0M',
        term: 'Singapore',
        type: 'city',
        lat: 1.352,
        lng: 103.82
      };

      destinations.getById.mockReturnValueOnce(mockDestination);

      const res = await request(app)
        .get('/destinations/WD0M');

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockDestination);
      expect(destinations.getById).toHaveBeenCalledWith('WD0M');
    });

    it('should return 404 when destination is not found', async () => {
      destinations.getById.mockReturnValueOnce(null);

      const res = await request(app)
        .get('/destinations/INVALID_UID');

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Destination not found');
      expect(destinations.getById).toHaveBeenCalledWith('INVALID_UID');
    });

    it('should handle empty UID parameter', async () => {
      destinations.getById.mockReturnValueOnce(null);

      const res = await request(app)
        .get('/destinations/');

      // This should match the search route instead
      expect(destinations.search).toHaveBeenCalled();
    });

    it('should forward errors from model to error middleware', async () => {
      const mockError = new Error('Database error');
      destinations.getById.mockImplementationOnce(() => {
        throw mockError;
      });

      const res = await request(app)
        .get('/destinations/WD0M');

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Database error');
    });
  });
});
