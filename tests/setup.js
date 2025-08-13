// Test environment setup for backend payment tests
import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.REACT_JWT_KEY = 'test_jwt_secret_key'; // Changed from JWT_SECRET to REACT_JWT_KEY
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_NAME = 'test_hotel_booking_db';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_stripe_key';

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Global test helpers
global.createMockRequest = (overrides = {}) => ({
  body: {},
  headers: {},
  params: {},
  query: {},
  ...overrides
});

global.createMockResponse = () => {
  const res = {
    locals: {},
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis()
  };
  return res;
};

global.createMockNext = () => jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
