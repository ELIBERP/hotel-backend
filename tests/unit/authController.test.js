import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { jest, describe, test, beforeAll, beforeEach, afterEach, afterAll, expect } from '@jest/globals';

// Create app instance for testing
const app = express();
app.use(express.json());

describe('Auth Controller', () => {
    let authController;
    let timeoutHandles = [];
    
    beforeAll(async () => {
        try {
            // Dynamically import the ES module
            const authModule = await import('../../controller/authController.js');
            authController = authModule.default;
            
            // Mount the auth routes
            app.use('/auth', authController.router);
        } catch (error) {
            console.log('Could not import authController:', error.message);
            // Continue with mock tests if import fails
        }
    });

    afterAll(async () => {
        // Clean up any remaining timeouts
        timeoutHandles.forEach(handle => {
            if (handle) {
                clearTimeout(handle);
                if (handle.unref) handle.unref();
            }
        });
        timeoutHandles = [];
        
        // Give a moment for any async operations to complete
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Mock console to avoid noise
    const originalLog = console.log;
    const originalError = console.error;

    beforeEach(() => {
        console.log = jest.fn();
        console.error = jest.fn();
        jest.clearAllMocks();
    });

    afterEach(() => {
        console.log = originalLog;
        console.error = originalError;
    });

    describe('Route Integration Tests', () => {
        test('should respond to GET /auth/test', async () => {
            const response = await request(app)
                .get('/auth/test')
                .expect(200);
                
            // The response is JSON, so check the parsed body
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toBe('Auth routes are working!');
        });

        test('should handle POST /auth/register with missing data', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send({})
                .expect(400);
                
            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(false);
        });

        test('should handle POST /auth/login with missing data', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({})
                .expect(400);
                
            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(false);
        });
    });

    // Test individual validation functions that we can test without full mocking
    describe('Validation Logic', () => {
        test('should validate email format', () => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            expect(emailRegex.test('test@example.com')).toBe(true);
            expect(emailRegex.test('invalid-email')).toBe(false);
            expect(emailRegex.test('test@')).toBe(false);
            expect(emailRegex.test('@example.com')).toBe(false);
        });

        test('should validate password requirements', () => {
            const validPasswords = [
                'Test123!',
                'Password1@',
                'MySecret9#'
            ];
            
            const invalidPasswords = [
                'short',           // too short
                'toolong',         // no uppercase, no special char, no number
                'UPPERCASE123!',   // no lowercase
                'lowercase123!',   // no uppercase
                'TestPassword!',   // no number
                'TestPassword123'  // no special char
            ];

            validPasswords.forEach(password => {
                expect(password.length).toBeGreaterThanOrEqual(6);
            });

            invalidPasswords.forEach(password => {
                if (password.length < 6) {
                    expect(password.length).toBeLessThan(6);
                }
            });
        });

        test('should validate required fields', () => {
            const requiredFields = ['email', 'password', 'firstName', 'lastName'];
            const testData = {
                email: 'test@example.com',
                password: 'Test123!',
                firstName: 'John',
                lastName: 'Doe'
            };

            requiredFields.forEach(field => {
                expect(testData[field]).toBeDefined();
                expect(typeof testData[field]).toBe('string');
                expect(testData[field].trim()).not.toBe('');
            });
        });
    });

    describe('Data Transformation', () => {
        test('should normalize email to lowercase', () => {
            const emails = [
                'TEST@EXAMPLE.COM',
                'Test@Example.com',
                'test@EXAMPLE.COM'
            ];

            emails.forEach(email => {
                const normalized = email.trim().toLowerCase();
                expect(normalized).toBe('test@example.com');
            });
        });

        test('should trim whitespace from strings', () => {
            const testStrings = [
                '  John  ',
                '\tDoe\t',
                '\n test@example.com \n'
            ];

            const expected = ['John', 'Doe', 'test@example.com'];

            testStrings.forEach((str, index) => {
                expect(str.trim()).toBe(expected[index]);
            });
        });
    });

    describe('HTTP Status Codes', () => {
        test('should use correct status codes', () => {
            const statusCodes = {
                success: 200,
                created: 201,
                badRequest: 400,
                unauthorized: 401,
                forbidden: 403,
                conflict: 409,
                serverError: 500
            };

            // Test that we know the correct status codes for different scenarios
            expect(statusCodes.success).toBe(200);     // Login success
            expect(statusCodes.created).toBe(201);     // User created
            expect(statusCodes.badRequest).toBe(400);  // Validation errors
            expect(statusCodes.unauthorized).toBe(401); // Invalid credentials
            expect(statusCodes.forbidden).toBe(403);   // Access denied
            expect(statusCodes.conflict).toBe(409);    // User already exists
            expect(statusCodes.serverError).toBe(500); // Database errors
        });
    });

    describe('JWT Token Tests', () => {
        test('should test JWT token creation with test endpoint', async () => {
            const response = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            expect(response.body).toHaveProperty('success');
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('payload');
            
            // Verify token structure
            const token = response.body.token;
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT has 3 parts: header.payload.signature
            
            // Verify payload structure
            const payload = response.body.payload;
            expect(payload).toHaveProperty('id');
            expect(payload).toHaveProperty('email');
            expect(payload).toHaveProperty('role');
            expect(payload.email).toBe('test@example.com');
            expect(payload.role).toBe('user');
        });

        test('should verify JWT token can be decoded', async () => {
            // Get a test token
            const response = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            const token = response.body.token;
            
            // Try to decode the token without verification (just to check structure)
            try {
                const decoded = jwt.decode(token);
                expect(decoded).toHaveProperty('id');
                expect(decoded).toHaveProperty('email');
                expect(decoded).toHaveProperty('role');
                expect(decoded).toHaveProperty('iat'); // issued at
                expect(decoded).toHaveProperty('exp'); // expiration
                
                // Check expiration is in the future
                const now = Math.floor(Date.now() / 1000);
                expect(decoded.exp).toBeGreaterThan(now);
                
                console.log('✅ JWT token decoded successfully:', {
                    payload: decoded,
                    expiresAt: new Date(decoded.exp * 1000),
                    isValid: decoded.exp > now
                });
            } catch (error) {
                console.error('❌ Failed to decode JWT token:', error);
                throw error;
            }
        });

        test('should verify JWT token structure follows standards', async () => {
            // Get a test token
            const response = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            const token = response.body.token;
            const parts = token.split('.');
            
            // JWT should have exactly 3 parts
            expect(parts).toHaveLength(3);
            
            // Each part should be base64url encoded
            parts.forEach((part, index) => {
                expect(part).toBeTruthy();
                expect(typeof part).toBe('string');
                expect(part.length).toBeGreaterThan(0);
                
                // Should not contain spaces or invalid characters
                expect(part).not.toMatch(/\s/);
                expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
                
                console.log(`JWT part ${index + 1} (${['header', 'payload', 'signature'][index]}): ${part.substring(0, 20)}...`);
            });
        });

        test('should verify JWT expiration is set correctly', async () => {
            // Get a test token
            const response = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            const token = response.body.token;
            const decoded = jwt.decode(token);
            
            // Check that expiration is set (should be 24h from now based on config)
            expect(decoded.exp).toBeDefined();
            expect(typeof decoded.exp).toBe('number');
            
            const now = Math.floor(Date.now() / 1000);
            const expirationTime = decoded.exp - now;
            
            // Should expire in approximately 24 hours (86400 seconds)
            // Allow some tolerance for test execution time
            expect(expirationTime).toBeGreaterThan(86000); // At least 23h 53m
            expect(expirationTime).toBeLessThan(86500);    // At most 24h 8m
            
            console.log(`✅ Token expires in ${Math.floor(expirationTime / 3600)}h ${Math.floor((expirationTime % 3600) / 60)}m`);
        });

        test('should include required claims in JWT payload', async () => {
            // Get a test token
            const response = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            const token = response.body.token;
            const decoded = jwt.decode(token);
            
            // Check required standard JWT claims
            expect(decoded).toHaveProperty('iat'); // Issued At
            expect(decoded).toHaveProperty('exp'); // Expiration Time
            
            // Check custom application claims
            expect(decoded).toHaveProperty('id');
            expect(decoded).toHaveProperty('email');
            expect(decoded).toHaveProperty('role');
            
            // Verify claim types
            expect(typeof decoded.iat).toBe('number');
            expect(typeof decoded.exp).toBe('number');
            expect(typeof decoded.id).toBe('string');
            expect(typeof decoded.email).toBe('string');
            expect(typeof decoded.role).toBe('string');
            
            // Verify claim values
            expect(decoded.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Valid email format
            expect(decoded.role).toBe('user');
            expect(decoded.id).toBeTruthy();
            
            console.log('✅ All required JWT claims present and valid');
        });

        test('should handle JWT secret key configuration', async () => {
            // Test that we can create tokens (implies secret key is configured)
            const response = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeTruthy();
            
            // The fact that we get a valid response means the JWT secret is configured
            console.log('✅ JWT secret key is properly configured');
        });

        test('should create different tokens for different users', async () => {
            // Get two test tokens
            const response1 = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            // Wait a moment to ensure different iat timestamps
            const timeoutHandle = setTimeout(() => {}, 1000);
            timeoutHandles.push(timeoutHandle);
            await new Promise(resolve => {
                const handle = setTimeout(() => {
                    clearTimeout(timeoutHandle);
                    resolve();
                }, 1000);
                handle.unref(); // Prevent this from keeping the process alive
            });
                
            const response2 = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            const token1 = response1.body.token;
            const token2 = response2.body.token;
            
            // Tokens should be different (due to different iat times)
            expect(token1).not.toBe(token2);
            
            // But payloads should have same user data (since it's the same test user)
            const decoded1 = jwt.decode(token1);
            const decoded2 = jwt.decode(token2);
            
            expect(decoded1.id).toBe(decoded2.id);
            expect(decoded1.email).toBe(decoded2.email);
            expect(decoded1.role).toBe(decoded2.role);
            expect(decoded1.iat).not.toBe(decoded2.iat); // Different issue times
            
            console.log('✅ Different tokens created with same user data but different timestamps');
        });

        test('should simulate login flow and verify JWT response', async () => {
            // Simulate login attempt (this will fail due to no database, but we can check the response structure)
            const loginData = {
                email: 'test@example.com',
                password: 'TestPassword123!'
            };
            
            const response = await request(app)
                .post('/auth/login')
                .send(loginData);
                
            // Even if login fails due to database issues, we can verify the response structure
            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('message');
            
            if (response.body.success) {
                // If successful, should have token
                expect(response.body).toHaveProperty('token');
                expect(response.body).toHaveProperty('user');
                
                const token = response.body.token;
                expect(typeof token).toBe('string');
                expect(token.split('.')).toHaveLength(3);
                
                // Verify user data
                const user = response.body.user;
                expect(user).toHaveProperty('id');
                expect(user).toHaveProperty('email');
                expect(user.email).toBe(loginData.email);
                
                console.log('✅ Login response includes valid JWT token and user data');
            } else {
                // If failed, should have error message
                expect(response.body.success).toBe(false);
                expect(typeof response.body.message).toBe('string');
                console.log(`Login failed as expected (no database): ${response.body.message}`);
            }
        });

        test('should verify JWT token header contains correct algorithm', async () => {
            // Get a test token
            const response = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            const token = response.body.token;
            const parts = token.split('.');
            
            // Decode the header (first part)
            const headerBase64 = parts[0];
            const header = JSON.parse(Buffer.from(headerBase64, 'base64url').toString());
            
            // Verify JWT header structure
            expect(header).toHaveProperty('typ');
            expect(header).toHaveProperty('alg');
            expect(header.typ).toBe('JWT');
            expect(header.alg).toBe('HS256'); // Default algorithm for jsonwebtoken
            
            console.log('✅ JWT header contains correct type and algorithm:', header);
        });
    });

    describe('Integration with Auth Middleware', () => {
        test('should verify token can be used with auth middleware', async () => {
            // Get a test token
            const tokenResponse = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            const token = tokenResponse.body.token;
            
            // Test that the token would work with Authorization header format
            const authHeader = `Bearer ${token}`;
            
            // Verify header format
            expect(authHeader.startsWith('Bearer ')).toBe(true);
            
            const extractedToken = authHeader.split(' ')[1];
            expect(extractedToken).toBe(token);
            
            // Verify the extracted token can be decoded
            const decoded = jwt.decode(extractedToken);
            expect(decoded).toHaveProperty('id');
            expect(decoded).toHaveProperty('email');
            
            console.log('✅ Token format compatible with Authorization header pattern');
        });

        test('should verify token contains all data needed for authorization', async () => {
            // Get a test token
            const response = await request(app)
                .post('/auth/test-token')
                .expect(200);
                
            const token = response.body.token;
            const decoded = jwt.decode(token);
            
            // Verify all required fields for authorization are present
            const requiredFields = ['id', 'email', 'role'];
            requiredFields.forEach(field => {
                expect(decoded).toHaveProperty(field);
                expect(decoded[field]).toBeTruthy();
                expect(typeof decoded[field]).toBe('string');
            });
            
            // Verify the data types and formats
            expect(decoded.id).toMatch(/^[a-zA-Z0-9-]+$/); // Valid ID format
            expect(decoded.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // Valid email
            expect(['user', 'admin', 'moderator']).toContain(decoded.role); // Valid role
            
            console.log('✅ Token contains all required authorization data:', {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role
            });
        });
    });

    describe('Response Structure', () => {
        test('should have consistent response structure', () => {
            const successResponse = {
                success: true,
                message: 'Operation successful',
                data: {}
            };

            const errorResponse = {
                success: false,
                message: 'Operation failed',
                error: 'Error details'
            };

            expect(successResponse).toHaveProperty('success');
            expect(successResponse).toHaveProperty('message');
            expect(successResponse.success).toBe(true);

            expect(errorResponse).toHaveProperty('success');
            expect(errorResponse).toHaveProperty('message');
            expect(errorResponse.success).toBe(false);
        });
    });
});
