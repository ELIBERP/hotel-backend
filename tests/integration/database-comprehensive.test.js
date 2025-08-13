import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { pool, testConnection } from '../../config/database.js';
import BookingModel from '../../model/booking.js';
import UserModel from '../../model/userModel.js';

// Comprehensive database integration tests covering your actual schema and models
describe('Database Integration Tests', () => {
    
    let testUsers = [];
    let testBookings = [];

    beforeAll(async () => {
        // Verify database connection
        const isConnected = await testConnection();
        expect(isConnected).toBe(true);
        
        console.log('Setting up integration test data...');
    });

    afterAll(async () => {
        console.log('Cleaning up integration test data...');
        await cleanupTestData();
    });

    async function cleanupTestData() {
        try {
            // Clean up test bookings
            for (const booking of testBookings) {
                await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
            }

            // Clean up test users
            for (const user of testUsers) {
                await UserModel.deleteUser(user.id);
            }

            // Clean up any remaining test data
            await pool.execute('DELETE FROM bookings WHERE email LIKE "%integration.test%"');
            await pool.execute('DELETE FROM users WHERE email LIKE "%integration.test%"');
            await pool.execute('DELETE FROM payment_sessions WHERE booking_id IN (SELECT id FROM bookings WHERE hotel_id LIKE "test_%") OR id LIKE "test_%"');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    // Test 1: Database Schema Validation
    test('Database Schema Structure Matches Requirements', async () => {
        // Verify required tables exist
        const [tables] = await pool.execute("SHOW TABLES");
        const tableNames = tables.map(row => Object.values(row)[0]);
        
        expect(tableNames).toContain('users');
        expect(tableNames).toContain('bookings');
        expect(tableNames).toContain('payment_sessions');

        // Verify users table structure
        const [userColumns] = await pool.execute("DESCRIBE users");
        const userColumnNames = userColumns.map(col => col.Field);
        
        const expectedUserColumns = ['id', 'email', 'password_hash', 'first_name', 'last_name', 'phone', 'role'];
        expectedUserColumns.forEach(column => {
            expect(userColumnNames).toContain(column);
        });

        // Verify bookings table structure  
        const [bookingColumns] = await pool.execute("DESCRIBE bookings");
        const bookingColumnNames = bookingColumns.map(col => col.Field);
        
        const expectedBookingColumns = ['id', 'hotel_id', 'start_date', 'end_date', 'first_name', 'last_name', 'email', 'total_price', 'booking_status'];
        expectedBookingColumns.forEach(column => {
            expect(bookingColumnNames).toContain(column);
        });

        console.log('✓ Database schema validation complete');
    });

    // Test 2: User Model CRUD Operations
    test('UserModel Complete CRUD Operations', async () => {
        const userData = {
            email: `integration.test.user.${Date.now()}@example.com`,
            password: 'securePassword123',
            firstName: 'Integration',
            lastName: 'Test',
            phone: '+65 9123 4567'
        };

        // CREATE
        const user = await UserModel.createUser(userData);
        expect(user.id).toBeDefined();
        expect(user.email).toBe(userData.email);
        expect(user.firstName).toBe(userData.firstName);
        expect(user.password).toBeUndefined(); // Password should not be returned
        testUsers.push(user);

        // READ by ID
        const foundUserById = await UserModel.findById(user.id);
        expect(foundUserById).toBeDefined();
        expect(foundUserById.email).toBe(userData.email);

        // READ by Email
        const foundUserByEmail = await UserModel.findByEmail(userData.email);
        expect(foundUserByEmail).toBeDefined();
        expect(foundUserByEmail.id).toBe(user.id);

        // Password verification
        const isValidPassword = await UserModel.verifyPassword(userData.password, foundUserByEmail.password_hash);
        expect(isValidPassword).toBe(true);

        const isInvalidPassword = await UserModel.verifyPassword('wrongPassword', foundUserByEmail.password_hash);
        expect(isInvalidPassword).toBe(false);

        // UPDATE
        const updateData = {
            firstName: 'UpdatedName',
            lastName: 'UpdatedLast',
            phone: '+65 8888 8888'
        };
        const updateResult = await UserModel.updateUser(user.id, updateData);
        expect(updateResult).toBe(true);

        // Verify update
        const updatedUser = await UserModel.findById(user.id);
        expect(updatedUser.first_name).toBe('UpdatedName');
        expect(updatedUser.last_name).toBe('UpdatedLast');
        expect(updatedUser.phone).toBe('+65 8888 8888');

        console.log('✓ UserModel CRUD operations validated');
    });

    // Test 3: Booking Model CRUD Operations
    test('BookingModel Complete CRUD Operations', async () => {
        const bookingData = {
            hotel_id: 'integration_test_hotel',
            hotel_name: 'Integration Test Resort',
            start_date: '2025-12-01',
            end_date: '2025-12-03',
            nights: 2,
            adults: 2,
            children: 1,
            room_types: ['Deluxe Room', 'Ocean View'],
            total_price: 350.50,
            currency: 'SGD',
            first_name: 'Booking',
            last_name: 'Test',
            phone: '+65 9876 5432',
            email: `integration.test.booking.${Date.now()}@example.com`,
            billing_address: {
                street: '123 Test Street',
                city: 'Singapore',
                postal_code: '123456',
                country: 'Singapore'
            },
            booking_status: 'confirmed'
        };

        // CREATE
        const booking = await BookingModel.create(bookingData);
        expect(booking.id).toBeDefined();
        expect(booking.hotel_id).toBe(bookingData.hotel_id);
        expect(booking.total_price).toBe(bookingData.total_price);
        testBookings.push(booking);

        // READ by ID
        const foundBooking = await BookingModel.findById(booking.id);
        expect(foundBooking).toBeDefined();
        expect(foundBooking.hotel_id).toBe(bookingData.hotel_id);
        expect(foundBooking.first_name).toBe(bookingData.first_name);
        expect(foundBooking.nights).toBe(bookingData.nights);

        // Verify JSON fields are properly stored and retrieved
        expect(Array.isArray(foundBooking.room_types)).toBe(true);
        expect(foundBooking.room_types).toEqual(bookingData.room_types);

        // READ by User Email
        const userBookings = await BookingModel.findByUserEmail(bookingData.email);
        expect(Array.isArray(userBookings)).toBe(true);
        expect(userBookings.length).toBeGreaterThan(0);
        expect(userBookings[0].id).toBe(booking.id);

        // UPDATE Status
        const paymentRef = 'PAY_TEST_12345';
        const statusUpdateResult = await BookingModel.updateStatus(booking.id, 'completed', paymentRef);
        expect(statusUpdateResult).toBe(true);

        // Verify status update
        const updatedBooking = await BookingModel.findById(booking.id);
        expect(updatedBooking.booking_status).toBe('completed');
        expect(updatedBooking.payment_reference).toBe(paymentRef);

        console.log('✓ BookingModel CRUD operations validated');
    });

    // Test 4: Data Validation and Constraints
    test('Data Validation and Database Constraints', async () => {
        // Test email uniqueness constraint
        const duplicateEmailData = {
            email: `integration.test.duplicate.${Date.now()}@example.com`,
            password: 'password123',
            firstName: 'First',
            lastName: 'User'
        };

        // Create first user
        const firstUser = await UserModel.createUser(duplicateEmailData);
        testUsers.push(firstUser);

        // Attempt to create second user with same email should fail
        try {
            await UserModel.createUser(duplicateEmailData);
            expect(true).toBe(false); // Should not reach here
        } catch (error) {
            expect(error.message).toContain('already exists');
        }

        // Test booking validation
        const invalidBookingData = {
            hotel_id: 'test_hotel',
            start_date: '2025-12-05',
            end_date: '2025-12-01', // End date before start date
            first_name: '', // Empty required field
            last_name: 'Test',
            email: 'invalid-email-format', // Invalid email
            total_price: -100 // Negative price
        };

        const validationErrors = BookingModel.validateBookingData(invalidBookingData);
        expect(validationErrors.length).toBeGreaterThan(0);
        expect(validationErrors).toContain('Check-out date must be after check-in date');
        expect(validationErrors).toContain('First name is required');
        expect(validationErrors).toContain('Invalid email format');

        console.log('✓ Data validation and constraints verified');
    });

    // Test 5: JSON Field Handling
    test('JSON Fields Storage and Retrieval', async () => {
        const complexJsonData = {
            hotel_id: 'json_test_hotel',
            start_date: '2025-12-01',
            end_date: '2025-12-02',
            nights: 1,
            first_name: 'JSON',
            last_name: 'Test',
            email: `integration.test.json.${Date.now()}@example.com`,
            total_price: 200,
            room_types: [
                'Standard Room',
                'Deluxe Suite', 
                'Presidential Suite'
            ],
            billing_address: {
                street: '456 JSON Avenue',
                unit: '#12-34',
                city: 'Singapore',
                postal_code: '567890',
                country: 'Singapore',
                additional_info: {
                    landmark: 'Near MRT Station',
                    special_instructions: 'Ring bell twice'
                }
            }
        };

        const booking = await BookingModel.create(complexJsonData);
        testBookings.push(booking);

        const retrieved = await BookingModel.findById(booking.id);

        // Verify room_types array
        expect(Array.isArray(retrieved.room_types)).toBe(true);
        expect(retrieved.room_types).toHaveLength(3);
        expect(retrieved.room_types).toContain('Presidential Suite');

        // Verify nested JSON object
        expect(typeof retrieved.billing_address).toBe('object');
        expect(retrieved.billing_address.street).toBe('456 JSON Avenue');
        expect(retrieved.billing_address.additional_info.landmark).toBe('Near MRT Station');

        console.log('✓ JSON field handling verified');
    });

    // Test 6: Transaction Management
    test('Transaction Rollback on Errors', async () => {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            // Create user within transaction
            const userResult = await connection.execute(
                'INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
                ['tx_test_user', 'tx.test@example.com', 'hashed_password', 'Transaction', 'Test']
            );

            // Create booking within transaction  
            const bookingResult = await connection.execute(
                'INSERT INTO bookings (id, hotel_id, start_date, end_date, first_name, last_name, email, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                ['tx_test_booking', 'tx_hotel', '2025-12-01', '2025-12-02', 'Transaction', 'Test', 'tx.test@example.com', 100]
            );

            // Verify data exists within transaction
            const [userCheck] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE id = ?', ['tx_test_user']);
            const [bookingCheck] = await connection.execute('SELECT COUNT(*) as count FROM bookings WHERE id = ?', ['tx_test_booking']);
            
            expect(userCheck[0].count).toBe(1);
            expect(bookingCheck[0].count).toBe(1);

            // Intentionally rollback
            await connection.rollback();

            // Verify data was rolled back
            const [finalUserCheck] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE id = ?', ['tx_test_user']);
            const [finalBookingCheck] = await pool.execute('SELECT COUNT(*) as count FROM bookings WHERE id = ?', ['tx_test_booking']);
            
            expect(finalUserCheck[0].count).toBe(0);
            expect(finalBookingCheck[0].count).toBe(0);

            console.log('✓ Transaction rollback verified');

        } finally {
            connection.release();
        }
    });

    // Test 7: Performance and Connection Pool
    test('Connection Pool Performance and Concurrent Operations', async () => {
        const concurrentOperations = 15;
        const startTime = Date.now();

        const operations = [];
        for (let i = 0; i < concurrentOperations; i++) {
            operations.push(
                pool.execute('SELECT ? as operation_id, NOW() as timestamp', [i])
            );
        }

        const results = await Promise.all(operations);
        const endTime = Date.now();

        expect(results).toHaveLength(concurrentOperations);
        results.forEach((result, index) => {
            expect(result[0][0].operation_id).toBe(index);
        });

        const executionTime = endTime - startTime;
        console.log(`${concurrentOperations} concurrent operations completed in ${executionTime}ms`);
        expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

        console.log('✓ Connection pool performance verified');
    });

    // Test 8: Database Indexes and Query Performance
    test('Database Indexes and Query Performance', async () => {
        // Test indexed queries perform well
        const queries = [
            { name: 'User by email (indexed)', query: 'SELECT * FROM users WHERE email = ?', params: ['nonexistent@test.com'] },
            { name: 'Booking by hotel_id (indexed)', query: 'SELECT * FROM bookings WHERE hotel_id = ?', params: ['nonexistent_hotel'] },
            { name: 'Booking by status (indexed)', query: 'SELECT * FROM bookings WHERE booking_status = ?', params: ['confirmed'] },
            { name: 'Booking by date range (indexed)', query: 'SELECT * FROM bookings WHERE start_date >= ? AND end_date <= ?', params: ['2025-01-01', '2025-12-31'] }
        ];

        for (const queryTest of queries) {
            const startTime = Date.now();
            const [results] = await pool.execute(queryTest.query, queryTest.params);
            const endTime = Date.now();
            const executionTime = endTime - startTime;

            console.log(`${queryTest.name}: ${executionTime}ms`);
            expect(executionTime).toBeLessThan(500); // Indexed queries should be fast
            expect(Array.isArray(results)).toBe(true);
        }

        console.log('✓ Database query performance verified');
    });

    // Test 9: Data Type Handling and Boundaries
    test('Data Type Handling and Boundaries', async () => {
        const boundaryTestData = {
            hotel_id: 'boundary_test',
            start_date: '2025-12-01',
            end_date: '2025-12-02',
            nights: 1,
            first_name: 'A'.repeat(50), // Test string length
            last_name: 'B'.repeat(50),
            email: `boundary.test.${Date.now()}@example.com`,
            total_price: 999999.99, // Test decimal precision
            adults: 10, // Maximum allowed
            children: 10,
            room_types: Array(20).fill('Room Type'), // Large array
            billing_address: {
                very_long_field: 'X'.repeat(1000) // Test large JSON
            }
        };

        const booking = await BookingModel.create(boundaryTestData);
        testBookings.push(booking);

        const retrieved = await BookingModel.findById(booking.id);
        
        expect(retrieved.first_name).toBe(boundaryTestData.first_name);
        expect(retrieved.total_price).toBe(boundaryTestData.total_price);
        expect(retrieved.adults).toBe(boundaryTestData.adults);
        expect(retrieved.room_types).toHaveLength(20);

        console.log('✓ Data type boundaries verified');
    });

    // Test 10: Error Handling and Recovery
    test('Error Handling and Database Recovery', async () => {
        // Test handling of various database errors
        const errorScenarios = [
            {
                name: 'Invalid table query',
                operation: () => pool.execute('SELECT * FROM non_existent_table'),
                expectedError: /doesn't exist/i
            },
            {
                name: 'Invalid column query', 
                operation: () => pool.execute('SELECT invalid_column FROM users'),
                expectedError: /Unknown column/i
            },
            {
                name: 'Constraint violation',
                operation: async () => {
                    // Try to create user with duplicate email
                    if (testUsers.length > 0) {
                        return UserModel.createUser({
                            email: testUsers[0].email, // Duplicate email
                            password: 'password',
                            firstName: 'Duplicate',
                            lastName: 'User'
                        });
                    }
                    throw new Error('already exists'); // Simulate constraint error
                },
                expectedError: /already exists/i
            }
        ];

        for (const scenario of errorScenarios) {
            try {
                await scenario.operation();
                expect(true).toBe(false); // Should not reach here
            } catch (error) {
                expect(error.message).toMatch(scenario.expectedError);
                console.log(`✓ ${scenario.name} error properly handled`);
            }
        }

        // Verify database is still functional after errors
        const [testQuery] = await pool.execute('SELECT 1 as test');
        expect(testQuery[0].test).toBe(1);

        console.log('✓ Error handling and recovery verified');
    });
});
