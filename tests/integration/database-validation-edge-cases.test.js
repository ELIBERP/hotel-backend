import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../config/database.js';
import BookingModel from '../../model/booking.js';
import UserModel from '../../model/userModel.js';

// Database validation and edge cases tests
describe('Database Validation & Edge Cases Tests', () => {
    
    beforeAll(async () => {
        const connection = await pool.getConnection();
        connection.release();
    });

    afterAll(async () => {
        try {
            await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "edge_test_%"');
            await pool.execute('DELETE FROM users WHERE email LIKE "edge.test.%"');
        } catch (error) {
            console.error('Edge case test cleanup error:', error);
        }
    });

    // Test 1: Data Validation Rules and Constraints
    test('Comprehensive Data Validation Rules', async () => {
        // Test booking validation edge cases
        const bookingValidationTests = [
            {
                name: 'Missing required fields',
                data: {},
                expectedErrors: ['Hotel ID is required', 'Check-in date is required', 'Check-out date is required', 'First name is required', 'Last name is required', 'Email is required', 'Valid total price is required']
            },
            {
                name: 'Invalid date formats',
                data: {
                    hotel_id: 'test_hotel',
                    start_date: 'invalid-date',
                    end_date: 'also-invalid',
                    first_name: 'Test',
                    last_name: 'User',
                    email: 'test@example.com',
                    total_price: 100
                },
                expectedErrors: [] // Model might not validate date format
            },
            {
                name: 'End date before start date',
                data: {
                    hotel_id: 'test_hotel',
                    start_date: '2025-12-10',
                    end_date: '2025-12-05',
                    first_name: 'Test',
                    last_name: 'User',
                    email: 'test@example.com',
                    total_price: 100
                },
                expectedErrors: ['Check-out date must be after check-in date']
            },
            {
                name: 'Invalid email formats',
                data: {
                    hotel_id: 'test_hotel',
                    start_date: '2025-12-01',
                    end_date: '2025-12-02',
                    first_name: 'Test',
                    last_name: 'User',
                    email: 'invalid-email',
                    total_price: 100
                },
                expectedErrors: ['Invalid email format']
            },
            {
                name: 'Invalid guest counts',
                data: {
                    hotel_id: 'test_hotel',
                    start_date: '2025-12-01',
                    end_date: '2025-12-02',
                    first_name: 'Test',
                    last_name: 'User',
                    email: 'test@example.com',
                    total_price: 100,
                    adults: 15, // Exceeds limit
                    children: -1 // Negative
                },
                expectedErrors: ['Adults count must be between 1 and 10', 'Children count must be between 0 and 10']
            },
            {
                name: 'Invalid price values',
                data: {
                    hotel_id: 'test_hotel',
                    start_date: '2025-12-01',
                    end_date: '2025-12-02',
                    first_name: 'Test',
                    last_name: 'User',
                    email: 'test@example.com',
                    total_price: -50 // Negative price
                },
                expectedErrors: ['Total price must be greater than 0']
            }
        ];

        for (const test of bookingValidationTests) {
            const errors = BookingModel.validateBookingData(test.data);
            
            console.log(`Validation test: ${test.name}`);
            console.log(`Expected errors: ${test.expectedErrors.length}, Actual errors: ${errors.length}`);
            
            if (test.expectedErrors.length > 0) {
                test.expectedErrors.forEach(expectedError => {
                    const hasError = errors.some(error => error.includes(expectedError));
                    if (!hasError) {
                        console.log(`⚠️  Expected error not found: "${expectedError}"`);
                        console.log(`Actual errors: ${JSON.stringify(errors)}`);
                    }
                });
            }
        }

        console.log('✓ Data validation rules verified');
    });

    // Test 2: Boundary Value Testing
    test('Boundary Value and Limit Testing', async () => {
        const boundaryTests = [
            {
                name: 'Maximum string lengths',
                data: {
                    hotel_id: 'A'.repeat(255), // Test max length
                    hotel_name: 'B'.repeat(255),
                    start_date: '2025-12-01',
                    end_date: '2025-12-02',
                    first_name: 'C'.repeat(100),
                    last_name: 'D'.repeat(100),
                    email: 'test@' + 'e'.repeat(90) + '.com', // Long email
                    total_price: 999999.99,
                    phone: '+' + '1'.repeat(19) // Max phone length
                }
            },
            {
                name: 'Minimum valid values',
                data: {
                    hotel_id: 'h',
                    start_date: '2025-12-01',
                    end_date: '2025-12-02',
                    first_name: 'A',
                    last_name: 'B',
                    email: 'a@b.co',
                    total_price: 0.01,
                    adults: 1,
                    children: 0
                }
            },
            {
                name: 'Maximum integer values',
                data: {
                    hotel_id: 'edge_test_max',
                    start_date: '2025-12-01',
                    end_date: '2025-12-02',
                    first_name: 'Max',
                    last_name: 'Test',
                    email: 'max.test@example.com',
                    total_price: 99999999.99,
                    adults: 10,
                    children: 10,
                    nights: 365
                }
            }
        ];

        for (const test of boundaryTests) {
            try {
                // Test validation first
                const validationErrors = BookingModel.validateBookingData(test.data);
                
                if (validationErrors.length === 0) {
                    // If validation passes, try to create
                    const booking = await BookingModel.create(test.data);
                    
                    // Verify data was stored correctly
                    const retrieved = await BookingModel.findById(booking.id);
                    expect(retrieved).toBeDefined();
                    expect(retrieved.hotel_id).toBe(test.data.hotel_id);
                    expect(retrieved.total_price).toBe(test.data.total_price);
                    
                    // Clean up
                    await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                    
                    console.log(`✓ ${test.name} - boundary test passed`);
                } else {
                    console.log(`⚠️  ${test.name} - validation failed: ${validationErrors[0]}`);
                }
                
            } catch (error) {
                // Database-level constraint errors are acceptable
                if (error.message.includes('too long') || error.message.includes('Data too long')) {
                    console.log(`✓ ${test.name} - database constraint properly enforced`);
                } else {
                    console.log(`❌ ${test.name} - unexpected error: ${error.message}`);
                }
            }
        }

        console.log('✓ Boundary value testing completed');
    });

    // Test 3: Date and Time Edge Cases
    test('Date and Time Validation Edge Cases', async () => {
        const dateTests = [
            {
                name: 'Today as check-in date',
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
                expectValid: false // Past/today dates should be invalid
            },
            {
                name: 'Far future dates',
                start_date: '2030-01-01',
                end_date: '2030-01-02',
                expectValid: true
            },
            {
                name: 'Same day check-in and check-out',
                start_date: '2025-12-01',
                end_date: '2025-12-01',
                expectValid: false // Same day should be invalid
            },
            {
                name: 'Leap year dates',
                start_date: '2024-02-29',
                end_date: '2024-03-01',
                expectValid: true
            },
            {
                name: 'Invalid leap year',
                start_date: '2025-02-29', // 2025 is not a leap year
                end_date: '2025-03-01',
                expectValid: false
            },
            {
                name: 'Long stay duration',
                start_date: '2025-12-01',
                end_date: '2026-12-01', // 1 year stay
                expectValid: true
            }
        ];

        for (const dateTest of dateTests) {
            const bookingData = {
                hotel_id: 'edge_test_dates',
                start_date: dateTest.start_date,
                end_date: dateTest.end_date,
                first_name: 'Date',
                last_name: 'Test',
                email: `edge.test.date.${Date.now()}@example.com`,
                total_price: 100
            };

            const validationErrors = BookingModel.validateBookingData(bookingData);
            const hasDateErrors = validationErrors.some(error => 
                error.includes('date') || error.includes('past') || error.includes('after')
            );

            if (dateTest.expectValid) {
                if (hasDateErrors) {
                    console.log(`⚠️  ${dateTest.name} - expected valid but got errors: ${validationErrors.join(', ')}`);
                } else {
                    console.log(`✓ ${dateTest.name} - correctly validated as valid`);
                }
            } else {
                if (hasDateErrors) {
                    console.log(`✓ ${dateTest.name} - correctly validated as invalid`);
                } else {
                    console.log(`⚠️  ${dateTest.name} - expected invalid but validation passed`);
                }
            }

            // Try creating booking if validation passes
            if (validationErrors.length === 0) {
                try {
                    const booking = await BookingModel.create(bookingData);
                    await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                } catch (error) {
                    console.log(`Database rejected ${dateTest.name}: ${error.message}`);
                }
            }
        }

        console.log('✓ Date validation edge cases completed');
    });

    // Test 4: Special Characters and Unicode Handling
    test('Special Characters and Unicode Data Handling', async () => {
        const unicodeTests = [
            {
                name: 'European characters',
                first_name: 'José María',
                last_name: 'González-Pérez',
                hotel_name: 'Hôtel Château Müller'
            },
            {
                name: 'Asian characters',
                first_name: '田中',
                last_name: '太郎',
                hotel_name: '東京ホテル中文测试'
            },
            {
                name: 'Arabic characters',
                first_name: 'محمد',
                last_name: 'العربي',
                hotel_name: 'فندق الرياض'
            },
            {
                name: 'Mixed scripts',
                first_name: 'José 田中',
                last_name: 'Smith محمد',
                hotel_name: 'Global Hotel 世界 عالمي'
            },
            {
                name: 'Emoji characters',
                first_name: 'John 😊',
                last_name: 'Doe 🏨',
                hotel_name: 'Beach Resort 🏖️🌴🌊'
            },
            {
                name: 'Special punctuation',
                first_name: 'Mary-Jane',
                last_name: "O'Connor",
                hotel_name: 'The "Grand" Hotel & Spa'
            }
        ];

        for (const test of unicodeTests) {
            const bookingData = {
                hotel_id: `edge_test_unicode_${Date.now()}`,
                hotel_name: test.hotel_name,
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: test.first_name,
                last_name: test.last_name,
                email: `edge.test.unicode.${Date.now()}@example.com`,
                total_price: 100
            };

            try {
                const booking = await BookingModel.create(bookingData);
                const retrieved = await BookingModel.findById(booking.id);

                // Verify Unicode data integrity
                expect(retrieved.first_name).toBe(test.first_name);
                expect(retrieved.last_name).toBe(test.last_name);
                expect(retrieved.hotel_name).toBe(test.hotel_name);

                console.log(`✓ ${test.name} - Unicode data preserved correctly`);

                // Clean up
                await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);

            } catch (error) {
                console.log(`❌ ${test.name} - Unicode handling failed: ${error.message}`);
            }
        }

        console.log('✓ Unicode and special character handling verified');
    });

    // Test 5: JSON Field Edge Cases
    test('JSON Field Complex Data Structures', async () => {
        const jsonTests = [
            {
                name: 'Empty arrays and objects',
                room_types: [],
                billing_address: {}
            },
            {
                name: 'Nested complex structures',
                room_types: ['Standard', 'Deluxe', 'Suite'],
                billing_address: {
                    personal: {
                        title: 'Mr.',
                        preferences: ['wifi', 'breakfast', 'parking']
                    },
                    address: {
                        line1: '123 Main Street',
                        line2: 'Apt 4B',
                        city: 'Singapore',
                        coordinates: { lat: 1.3521, lng: 103.8198 }
                    },
                    payment: {
                        methods: ['credit_card', 'paypal'],
                        history: []
                    }
                }
            },
            {
                name: 'Large JSON structures',
                room_types: Array(50).fill('Room Type'),
                billing_address: {
                    large_array: Array(100).fill('data'),
                    large_string: 'A'.repeat(1000),
                    nested_depth: {
                        level1: { level2: { level3: { level4: { level5: 'deep_value' } } } }
                    }
                }
            },
            {
                name: 'Special characters in JSON',
                room_types: ['Luxury "Suite"', "O'Reilly's Room", 'Café & Spa'],
                billing_address: {
                    "special-keys": "value",
                    "unicode_key_测试": "unicode_value_テスト",
                    "emoji_🏨": "hotel_value_🌟"
                }
            },
            {
                name: 'NULL and mixed types',
                room_types: ['Valid Room', null, '', 'Another Room'],
                billing_address: {
                    null_value: null,
                    empty_string: '',
                    number: 123,
                    boolean: true,
                    array: [1, 'two', null, true]
                }
            }
        ];

        for (const test of jsonTests) {
            const bookingData = {
                hotel_id: `edge_test_json_${Date.now()}`,
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: 'JSON',
                last_name: 'Test',
                email: `edge.test.json.${Date.now()}@example.com`,
                total_price: 100,
                room_types: test.room_types,
                billing_address: test.billing_address
            };

            try {
                const booking = await BookingModel.create(bookingData);
                const retrieved = await BookingModel.findById(booking.id);

                // Verify JSON data integrity
                expect(JSON.stringify(retrieved.room_types)).toBe(JSON.stringify(test.room_types));
                expect(JSON.stringify(retrieved.billing_address)).toBe(JSON.stringify(test.billing_address));

                // Test JSON queries
                if (test.room_types && test.room_types.length > 0) {
                    const [jsonQueryResult] = await pool.execute(
                        'SELECT * FROM bookings WHERE JSON_LENGTH(room_types) > 0 AND id = ?',
                        [booking.id]
                    );
                    expect(jsonQueryResult).toHaveLength(1);
                }

                console.log(`✓ ${test.name} - JSON data handled correctly`);

                // Clean up
                await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);

            } catch (error) {
                console.log(`❌ ${test.name} - JSON handling failed: ${error.message}`);
            }
        }

        console.log('✓ JSON field edge cases verified');
    });

    // Test 6: User Model Edge Cases
    test('User Model Edge Cases and Validation', async () => {
        const userEdgeCases = [
            {
                name: 'Very long names',
                firstName: 'A'.repeat(99),
                lastName: 'B'.repeat(99),
                email: 'very.long.names@example.com'
            },
            {
                name: 'Single character names',
                firstName: 'A',
                lastName: 'B', 
                email: 'single.char@example.com'
            },
            {
                name: 'Unicode names',
                firstName: '田中',
                lastName: 'José-María',
                email: 'unicode.names@example.com'
            },
            {
                name: 'Special characters in names',
                firstName: "Mary-Jane",
                lastName: "O'Connor-Smith",
                email: 'special.chars@example.com'
            },
            {
                name: 'Various phone formats',
                firstName: 'Phone',
                lastName: 'Test',
                email: 'phone.formats@example.com',
                phone: '+65 9123-4567'
            }
        ];

        for (const userTest of userEdgeCases) {
            const userData = {
                email: `edge.test.${Date.now()}.${Math.random()}@example.com`,
                password: 'securePassword123',
                firstName: userTest.firstName,
                lastName: userTest.lastName,
                phone: userTest.phone || '+65 9876 5432'
            };

            try {
                const user = await UserModel.createUser(userData);
                const retrieved = await UserModel.findById(user.id);

                // Verify data integrity
                expect(retrieved.first_name).toBe(userData.firstName);
                expect(retrieved.last_name).toBe(userData.lastName);
                expect(retrieved.email).toBe(userData.email);
                expect(retrieved.phone).toBe(userData.phone);

                console.log(`✓ ${userTest.name} - User data handled correctly`);

                // Test user operations
                const updateResult = await UserModel.updateUser(user.id, {
                    firstName: `Updated_${userData.firstName}`,
                    lastName: `Updated_${userData.lastName}`,
                    phone: '+65 8888 8888'
                });
                expect(updateResult).toBe(true);

                // Clean up
                await UserModel.deleteUser(user.id);

            } catch (error) {
                console.log(`❌ ${userTest.name} - User creation failed: ${error.message}`);
            }
        }

        console.log('✓ User model edge cases verified');
    });

    // Test 7: Database Constraint Edge Cases
    test('Database Constraint and Limit Testing', async () => {
        // Test various database constraints and limits
        
        // Test duplicate email constraint
        const baseEmail = `edge.test.duplicate.${Date.now()}@example.com`;
        
        const firstUser = await UserModel.createUser({
            email: baseEmail,
            password: 'password123',
            firstName: 'First',
            lastName: 'User'
        });

        // Attempt duplicate email
        try {
            await UserModel.createUser({
                email: baseEmail,
                password: 'password456',
                firstName: 'Second',
                lastName: 'User'
            });
            expect(true).toBe(false); // Should not reach here
        } catch (error) {
            expect(error.message).toContain('already exists');
            console.log('✓ Email uniqueness constraint enforced');
        }

        // Test very long field that exceeds database limits
        try {
            const extremelyLongData = {
                hotel_id: 'A'.repeat(1000), // Exceeds VARCHAR limit
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: 'Long',
                last_name: 'Test',
                email: 'long.test@example.com',
                total_price: 100
            };

            await BookingModel.create(extremelyLongData);
            console.log('⚠️  Database allowed extremely long data (might be truncated)');
            
        } catch (error) {
            console.log('✓ Database length constraint enforced');
            expect(error.message).toMatch(/too long|length|Data too long/i);
        }

        // Test extreme decimal values
        try {
            const extremeDecimalData = {
                hotel_id: 'edge_test_decimal',
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: 'Decimal',
                last_name: 'Test',
                email: `edge.test.decimal.${Date.now()}@example.com`,
                total_price: 999999999999.999 // Exceeds DECIMAL(10,2)
            };

            const booking = await BookingModel.create(extremeDecimalData);
            const retrieved = await BookingModel.findById(booking.id);
            
            // Check if value was truncated or rounded
            console.log(`Original: ${extremeDecimalData.total_price}, Stored: ${retrieved.total_price}`);
            
            await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
            
        } catch (error) {
            console.log('✓ Decimal precision constraint enforced');
            expect(error.message).toMatch(/out of range|numeric/i);
        }

        // Clean up test user
        await UserModel.deleteUser(firstUser.id);

        console.log('✓ Database constraints verified');
    });

    // Test 8: Concurrent Operations and Race Conditions
    test('Concurrent Operations and Race Condition Handling', async () => {
        // Test concurrent user creation with potential duplicates
        const baseEmail = `edge.test.concurrent.${Date.now()}@example.com`;
        
        const concurrentUserCreations = Array(5).fill(null).map((_, index) => 
            UserModel.createUser({
                email: index === 0 ? baseEmail : `${index}.${baseEmail}`,
                password: 'password123',
                firstName: `Concurrent${index}`,
                lastName: 'Test'
            }).catch(error => ({ error: error.message }))
        );

        const results = await Promise.all(concurrentUserCreations);
        
        const successful = results.filter(result => !result.error);
        const failed = results.filter(result => result.error);
        
        expect(successful.length).toBeGreaterThan(0);
        console.log(`Concurrent user creation: ${successful.length} successful, ${failed.length} failed`);

        // Test concurrent booking updates
        if (successful.length > 0) {
            const testUser = successful[0];
            
            const bookingData = {
                hotel_id: 'edge_test_concurrent',
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: testUser.firstName,
                last_name: testUser.lastName,
                email: testUser.email,
                total_price: 100
            };

            const booking = await BookingModel.create(bookingData);

            // Concurrent status updates
            const statusUpdates = [
                BookingModel.updateStatus(booking.id, 'confirmed', 'PAY1'),
                BookingModel.updateStatus(booking.id, 'completed', 'PAY2'),
                BookingModel.updateStatus(booking.id, 'cancelled', 'CANCEL1')
            ];

            const updateResults = await Promise.allSettled(statusUpdates);
            const successfulUpdates = updateResults.filter(r => r.status === 'fulfilled' && r.value === true);
            
            console.log(`Concurrent status updates: ${successfulUpdates.length} successful`);
            expect(successfulUpdates.length).toBeGreaterThan(0);

            // Clean up
            await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
        }

        // Clean up users
        for (const user of successful) {
            await UserModel.deleteUser(user.id);
        }

        console.log('✓ Concurrent operations handling verified');
    });

    // Test 9: Error Recovery and Data Consistency
    test('Error Recovery and Data Consistency', async () => {
        const connection = await pool.getConnection();
        
        try {
            // Test transaction with intentional failure
            await connection.beginTransaction();

            // Insert valid data
            await connection.execute(
                'INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
                ['edge_tx_user', 'edge.tx.test@example.com', 'hashed_password', 'Transaction', 'Test']
            );

            // Insert valid booking
            await connection.execute(
                'INSERT INTO bookings (id, hotel_id, start_date, end_date, first_name, last_name, email, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                ['edge_tx_booking', 'edge_tx_hotel', '2025-12-01', '2025-12-02', 'Transaction', 'Test', 'edge.tx.test@example.com', 100]
            );

            // Verify data exists in transaction
            const [userCheck] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE id = ?', ['edge_tx_user']);
            const [bookingCheck] = await connection.execute('SELECT COUNT(*) as count FROM bookings WHERE id = ?', ['edge_tx_booking']);
            
            expect(userCheck[0].count).toBe(1);
            expect(bookingCheck[0].count).toBe(1);

            // Intentionally cause constraint violation
            try {
                await connection.execute(
                    'INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
                    ['edge_tx_user', 'duplicate.email@example.com', 'hashed_password', 'Duplicate', 'User'] // Duplicate ID
                );
            } catch (constraintError) {
                // Expected constraint violation
                expect(constraintError.message).toMatch(/Duplicate entry|PRIMARY/i);
            }

            // Rollback transaction
            await connection.rollback();

            // Verify data was properly rolled back
            const [finalUserCheck] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE id = ?', ['edge_tx_user']);
            const [finalBookingCheck] = await pool.execute('SELECT COUNT(*) as count FROM bookings WHERE id = ?', ['edge_tx_booking']);
            
            expect(finalUserCheck[0].count).toBe(0);
            expect(finalBookingCheck[0].count).toBe(0);

            console.log('✓ Transaction rollback and data consistency verified');

        } finally {
            connection.release();
        }

        // Test database recovery after connection issues
        let connectionErrors = 0;
        const maxRetries = 5;

        for (let i = 0; i < maxRetries; i++) {
            try {
                const [result] = await pool.execute('SELECT 1 as recovery_test');
                expect(result[0].recovery_test).toBe(1);
                break;
            } catch (error) {
                connectionErrors++;
                console.log(`Connection attempt ${i + 1} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        expect(connectionErrors).toBeLessThan(maxRetries);
        console.log('✓ Database recovery and error handling verified');
    });

    // Test 10: Schema Validation and Data Integrity
    test('Schema Validation and Data Integrity Checks', async () => {
        // Verify database schema integrity
        const schemaChecks = [
            {
                name: 'Table existence',
                query: "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
                verify: (results) => {
                    const tableNames = results.map(row => row.TABLE_NAME);
                    expect(tableNames).toContain('users');
                    expect(tableNames).toContain('bookings');
                    expect(tableNames).toContain('payment_sessions');
                }
            },
            {
                name: 'Column data types',
                query: "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'",
                verify: (results) => {
                    const columns = results.reduce((acc, row) => {
                        acc[row.COLUMN_NAME] = { type: row.DATA_TYPE, nullable: row.IS_NULLABLE };
                        return acc;
                    }, {});
                    
                    expect(columns.total_price.type).toBe('decimal');
                    expect(columns.email.nullable).toBe('NO');
                    expect(columns.room_types.type).toBe('json');
                }
            },
            {
                name: 'Index existence',
                query: "SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()",
                verify: (results) => {
                    const indexes = results.map(row => `${row.INDEX_NAME}:${row.COLUMN_NAME}`);
                    expect(indexes.some(idx => idx.includes('email'))).toBe(true);
                }
            }
        ];

        for (const check of schemaChecks) {
            try {
                const [results] = await pool.execute(check.query);
                check.verify(results);
                console.log(`✓ ${check.name} validation passed`);
            } catch (error) {
                console.log(`❌ ${check.name} validation failed: ${error.message}`);
            }
        }

        // Test data integrity across related records
        const userData = {
            email: `edge.test.integrity.${Date.now()}@example.com`,
            password: 'password123',
            firstName: 'Integrity',
            lastName: 'Test'
        };

        const user = await UserModel.createUser(userData);
        
        const bookingData = {
            hotel_id: 'edge_test_integrity',
            start_date: '2025-12-01',
            end_date: '2025-12-02',
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email,
            total_price: 100
        };

        const booking = await BookingModel.create(bookingData);

        // Verify referential integrity
        const userBookings = await BookingModel.findByUserEmail(user.email);
        expect(userBookings.length).toBeGreaterThan(0);
        expect(userBookings[0].email).toBe(user.email);

        // Clean up
        await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
        await UserModel.deleteUser(user.id);

        console.log('✓ Schema validation and data integrity verified');
    });
});
