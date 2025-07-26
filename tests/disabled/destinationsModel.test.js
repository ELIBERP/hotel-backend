import destinations from '../../model/destinations.js';
import { jest } from '@jest/globals';

describe('Destinations Model Unit Tests', () => {
  describe('destinations.search - Destination Autocomplete', () => {
    it('should return suggestions for valid partial input', () => {
      const results = destinations.search('London');
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(dest => 
        dest.term.toLowerCase().includes('london')
      )).toBe(true);
    });

    it('should return suggestions for case-insensitive search', () => {
      const results = destinations.search('singapore');
      
      expect(results).toBeInstanceOf(Array);
      expect(results.some(dest => 
        dest.term.toLowerCase().includes('singapore')
      )).toBe(true);
    });

    it('should limit results to 10 suggestions maximum', () => {
      const results = destinations.search('a'); // Very broad search
      
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty input gracefully', () => {
      const results = destinations.search('');
      
      expect(results).toEqual([]);
    });

    it('should handle null input gracefully', () => {
      const results = destinations.search(null);
      
      expect(results).toEqual([]);
    });

    it('should handle undefined input gracefully', () => {
      const results = destinations.search(undefined);
      
      expect(results).toEqual([]);
    });

    it('should handle non-string input gracefully', () => {
      const results = destinations.search(123);
      
      expect(results).toEqual([]);
    });

    it('should sanitize special characters and whitespace', () => {
      const results = destinations.search('  Tokyo@#$%  ');
      
      expect(results).toBeInstanceOf(Array);
      // Should still find Tokyo despite special characters
      expect(results.some(dest => 
        dest.term.toLowerCase().includes('tokyo')
      )).toBe(true);
    });

    it('should return empty array for only special characters', () => {
      const results = destinations.search('@#$%^&*()');
      
      expect(results).toEqual([]);
    });

    it('should return empty array for only whitespace', () => {
      const results = destinations.search('   ');
      
      expect(results).toEqual([]);
    });

    it('should handle partial matches correctly', () => {
      const results = destinations.search('Par');
      
      expect(results).toBeInstanceOf(Array);
      expect(results.some(dest => 
        dest.term.toLowerCase().includes('par')
      )).toBe(true);
    });
  });

  describe('destinations.getById - Get Destination by UID', () => {
    it('should return destination when valid UID is provided', () => {
      // Using a known UID from the destinations data
      const result = destinations.getById('WD0M');
      
      expect(result).toBeDefined();
      expect(result.uid).toBe('WD0M');
      expect(result.term).toBeDefined();
    });

    it('should return null when invalid UID is provided', () => {
      const result = destinations.getById('INVALID_UID');
      
      expect(result).toBeNull();
    });

    it('should handle null UID gracefully', () => {
      const result = destinations.getById(null);
      
      expect(result).toBeNull();
    });

    it('should handle undefined UID gracefully', () => {
      const result = destinations.getById(undefined);
      
      expect(result).toBeNull();
    });

    it('should handle non-string UID gracefully', () => {
      const result = destinations.getById(123);
      
      expect(result).toBeNull();
    });

    it('should return exact match for valid UID', () => {
      const result = destinations.getById('jC3Y'); // London from the actual data
      
      expect(result).toBeDefined();
      expect(result.uid).toBe('jC3Y');
      expect(result.term).toContain('London');
    });
  });
});
