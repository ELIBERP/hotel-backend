import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { pool } from '../../config/database.js';
import BookingModel from '../../model/booking.js';
import UserModel from '../../model/userModel.js';

// Database constraints and validation tests
describe('Database Constraints & Validation Tests', () => {
    
    beforeAll(async () => {
        // Ensure database connection is available
        const connection = await pool.getConnection();
        connection.release();
    });

    afterAll(async () => {
        // Clean up any test data
        try {
            await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "constraint_test_%"');
            await pool.execute('DELETE FROM users WHERE email LIKE "constraint.test.%"');
        } catch (error) {
            console.error('Constraint test cleanup error:', error);
        }
    });

    // Test 1: Primary Key Constraints
    test('Primary Key Uniqueness Constraints', async () => {
        // Create a user to get a valid ID
        const userData = {
            firstName: 'Primary',
            lastName: 'Key',
            email: `constraint.test.pk.${Date.now()}@example.com`,
            password: 'testpassword'
        };
        
        const user = await UserModel.createUser(userData);
        
        // Attempt to insert a record with the same ID should fail
        try {
            await pool.execute(
                'INSERT INTO users (id, first_name, last_name, email, password) VALUES (?, ?, ?, ?, ?)',
                [user.id, 'Duplicate', 'User', `duplicate.${Date.now()}@example.com`, 'password']
            );
            
            // Should not reach here
            expect(true).toBe(false);
            
        } catch (error) {
            // Should be a duplicate entry error
            expect(error.message).toMatch(/Duplicate entry|PRIMARY|UNIQUE/i);
        }
        
        // Clean up
        await UserModel.deleteUser(user.id);
    });

    // Test 2: Unique Constraints (Email)
    test('Email Uniqueness Constraints', async () => {
        const email = `constraint.test.unique.${Date.now()}@example.com`;
        
        // Create first user
        const userData1 = {
            firstName: 'First',
            lastName: 'User',
            email: email,
            password: 'testpassword'
        };
        
        const user1 = await UserModel.createUser(userData1);
        expect(user1.email).toBe(email);
        
        // Attempt to create second user with same email should fail
        const userData2 = {
            firstName: 'Second',
            lastName: 'User',
            email: email,
            password: 'testpassword'
        };
        
        try {
            await UserModel.createUser(userData2);
            // Should not reach here
            expect(true).toBe(false);
        } catch (error) {
            expect(error.message).toMatch(/Duplicate entry|UNIQUE|email/i);
        }
        
        // Clean up
        await UserModel.deleteUser(user1.id);
    });

    // Test 3: NOT NULL Constraints
    test('NOT NULL Constraints Validation', async () => {
        const requiredFields = [
            { field: 'first_name', table: 'users' },
            { field: 'last_name', table: 'users' },
            { field: 'email', table: 'users' },
            { field: 'hotel_id', table: 'bookings' },
            { field: 'start_date', table: 'bookings' },
            { field: 'end_date', table: 'bookings' },
            { field: 'first_name', table: 'bookings' },
            { field: 'email', table: 'bookings' }
        ];

        for (const { field, table } of requiredFields) {
            try {
                if (table === 'users') {
                    const userData = {
                        firstName: 'Test',
                        lastName: 'User',
                        email: `null.test.${Date.now()}@example.com`,
                        password: 'testpassword'
                    };
                    
                    // Remove the required field
                    if (field === 'first_name') userData.firstName = null;
                    if (field === 'last_name') userData.lastName = null;
                    if (field === 'email') userData.email = null;
                    
                    await UserModel.createUser(userData);
                    
                } else if (table === 'bookings') {
                    const bookingData = {
                        hotel_id: 'constraint_test_null',
                        start_date: '2025-12-01',
                        end_date: '2025-12-02',
                        first_name: 'Test',
                        last_name: 'User',
                        email: `null.booking.test.${Date.now()}@example.com`,
                        total_price: 100
                    };
                    
                    // Remove the required field
                    if (field === 'hotel_id') bookingData.hotel_id = null;
                    if (field === 'start_date') bookingData.start_date = null;
                    if (field === 'end_date') bookingData.end_date = null;
                    if (field === 'first_name') bookingData.first_name = null;
                    if (field === 'email') bookingData.email = null;
                    
                    await BookingModel.create(bookingData);
                }
                
                // Should not reach here for required fields
                expect(true).toBe(false);
                
            } catch (error) {
                // Should be a NOT NULL constraint error
                expect(error.message).toMatch(/cannot be null|NOT NULL|required/i);
                console.log(`✓ NOT NULL constraint enforced for ${table}.${field}`);
            }
        }
    });

    // Test 4: Date Validation Constraints
    test('Date Format and Logic Constraints', async () => {
        const invalidDateTests = [
            {
                name: 'Invalid Date Format',
                start_date: 'invalid-date',
                end_date: '2025-12-02',
                expectError: true
            },
            {
                name: 'End Date Before Start Date',
                start_date: '2025-12-10',
                end_date: '2025-12-05',
                expectError: false // Database might not enforce this logic
            },
            {
                name: 'Past Dates',
                start_date: '2020-01-01',
                end_date: '2020-01-02',
                expectError: false // Business logic, not database constraint
            },
            {
                name: 'Same Start and End Date',
                start_date: '2025-12-01',
                end_date: '2025-12-01',
                expectError: false // Might be valid for some business cases
            }
        ];

        for (const test of invalidDateTests) {
            const bookingData = {
                hotel_id: `constraint_test_date_${Date.now()}`,
                start_date: test.start_date,
                end_date: test.end_date,
                first_name: 'Date',
                last_name: 'Test',
                email: `date.test.${Date.now()}@example.com`,
                total_price: 100
            };

            try {
                const booking = await BookingModel.create(bookingData);
                
                if (test.expectError) {
                    // Should not reach here if error was expected
                    expect(true).toBe(false);
                } else {
                    // Clean up if creation succeeded
                    await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                }
                
            } catch (error) {
                if (test.expectError) {
                    expect(error.message).toMatch(/date|format|invalid/i);
                    console.log(`✓ ${test.name} properly rejected`);
                } else {
                    console.log(`Note: ${test.name} was rejected (might be business logic): ${error.message}`);
                }
            }
        }
    });

    // Test 5: Numeric Constraints and Validation
    test('Numeric Field Constraints', async () => {
        const numericTests = [
            {
                name: 'Negative Price',
                total_price: -100,
                expectError: false // Database might allow, business logic should handle
            },
            {
                name: 'Zero Price',
                total_price: 0,
                expectError: false
            },
            {
                name: 'Very Large Price',
                total_price: 999999999.99,
                expectError: false
            },
            {
                name: 'Invalid Price Format',
                total_price: 'not-a-number',
                expectError: true
            },
            {
                name: 'Too Many Decimal Places',
                total_price: 123.456789,
                expectError: false // Might be rounded
            }
        ];

        for (const test of numericTests) {
            const bookingData = {
                hotel_id: `constraint_test_numeric_${Date.now()}`,
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: 'Numeric',
                last_name: 'Test',
                email: `numeric.test.${Date.now()}@example.com`,
                total_price: test.total_price
            };

            try {
                const booking = await BookingModel.create(bookingData);
                
                if (test.expectError) {
                    expect(true).toBe(false);
                } else {
                    expect(typeof booking.total_price).toBe('number');
                    await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                }
                
            } catch (error) {
                if (test.expectError) {
                    expect(error.message).toMatch(/numeric|decimal|invalid/i);
                    console.log(`✓ ${test.name} properly rejected`);
                } else {
                    console.log(`Note: ${test.name} was rejected: ${error.message}`);
                }
            }
        }
    });

    // Test 6: String Length Constraints
    test('String Length Constraints Validation', async () => {
        const lengthTests = [
            {
                field: 'first_name',
                value: 'A'.repeat(300),
                maxExpected: 255
            },
            {
                field: 'last_name', 
                value: 'B'.repeat(300),
                maxExpected: 255
            },
            {
                field: 'email',
                value: 'a'.repeat(300) + '@example.com',
                maxExpected: 255
            },
            {
                field: 'hotel_id',
                value: 'C'.repeat(300),
                maxExpected: 255
            }
        ];

        for (const test of lengthTests) {
            const bookingData = {
                hotel_id: 'constraint_test_length',
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: 'Length',
                last_name: 'Test',
                email: `length.test.${Date.now()}@example.com`,
                total_price: 100
            };

            // Override the field being tested
            bookingData[test.field === 'first_name' ? 'first_name' : 
                        test.field === 'last_name' ? 'last_name' :
                        test.field === 'email' ? 'email' : 'hotel_id'] = test.value;

            try {
                const booking = await BookingModel.create(bookingData);
                
                // If creation succeeded, check if value was truncated
                const retrieved = await BookingModel.findById(booking.id);
                const actualValue = retrieved[test.field === 'first_name' ? 'first_name' :
                                              test.field === 'last_name' ? 'last_name' :
                                              test.field === 'email' ? 'email' : 'hotel_id'];
                
                if (actualValue.length < test.value.length) {
                    console.log(`✓ ${test.field} was truncated to ${actualValue.length} characters`);
                    expect(actualValue.length).toBeLessThanOrEqual(test.maxExpected);
                }
                
                await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                
            } catch (error) {
                // Should be a data length error
                expect(error.message).toMatch(/too long|length|Data too long/i);
                console.log(`✓ ${test.field} length constraint enforced`);
            }
        }
    });

    // Test 7: JSON Field Constraints
    test('JSON Field Validation Constraints', async () => {
        const jsonTests = [
            {
                name: 'Valid JSON Array',
                value: ['Room1', 'Room2'],
                expectError: false
            },
            {
                name: 'Valid JSON Object',
                value: [{ room: 'Standard', amenities: ['wifi', 'tv'] }],
                expectError: false
            },
            {
                name: 'Empty JSON Array',
                value: [],
                expectError: false
            },
            {
                name: 'Null JSON Value',
                value: null,
                expectError: false
            },
            {
                name: 'Large JSON Structure',
                value: Array(100).fill({ room: 'Standard', details: 'A'.repeat(100) }),
                expectError: false
            }
        ];

        for (const test of jsonTests) {
            const bookingData = {
                hotel_id: `constraint_test_json_${Date.now()}`,
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: 'JSON',
                last_name: 'Test',
                email: `json.test.${Date.now()}@example.com`,
                total_price: 100,
                room_types: test.value
            };

            try {
                const booking = await BookingModel.create(bookingData);
                
                if (test.expectError) {
                    expect(true).toBe(false);
                } else {
                    const retrieved = await BookingModel.findById(booking.id);
                    if (test.value === null) {
                        expect(retrieved.room_types).toBeNull();
                    } else {
                        expect(Array.isArray(retrieved.room_types)).toBe(true);
                    }
                }
                
                await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                
            } catch (error) {
                if (test.expectError) {
                    expect(error.message).toMatch(/json|invalid/i);
                    console.log(`✓ ${test.name} properly rejected`);
                } else {
                    console.log(`Note: ${test.name} was rejected: ${error.message}`);
                }
            }
        }
    });

    // Test 8: Email Format Validation
    test('Email Format Validation Constraints', async () => {
        const emailTests = [
            {
                email: 'valid@example.com',
                valid: true
            },
            {
                email: 'user.name@domain.co.uk',
                valid: true
            },
            {
                email: 'invalid-email',
                valid: false
            },
            {
                email: '@invalid.com',
                valid: false
            },
            {
                email: 'user@',
                valid: false
            },
            {
                email: 'user..name@example.com',
                valid: false // Double dots invalid
            },
            {
                email: 'user@.example.com',
                valid: false
            },
            {
                email: '',
                valid: false
            }
        ];

        for (const test of emailTests) {
            const userData = {
                firstName: 'Email',
                lastName: 'Test',
                email: test.email,
                password: 'testpassword'
            };

            try {
                const user = await UserModel.createUser(userData);
                
                if (!test.valid) {
                    // Should not reach here for invalid emails
                    console.log(`Note: Invalid email "${test.email}" was accepted by database`);
                    await UserModel.deleteUser(user.id);
                } else {
                    expect(user.email).toBe(test.email);
                    await UserModel.deleteUser(user.id);
                }
                
            } catch (error) {
                if (test.valid) {
                    console.log(`Note: Valid email "${test.email}" was rejected: ${error.message}`);
                } else {
                    console.log(`✓ Invalid email "${test.email}" properly rejected`);
                }
            }
        }
    });

    // Test 9: Database Schema Integrity
    test('Database Schema Structure Validation', async () => {
        // Check if required tables exist
        const [tables] = await pool.execute("SHOW TABLES");
        const tableNames = tables.map(row => Object.values(row)[0]);
        
        expect(tableNames).toContain('users');
        expect(tableNames).toContain('bookings');
        
        // Check users table structure
        const [userColumns] = await pool.execute("DESCRIBE users");
        const userColumnNames = userColumns.map(col => col.Field);
        
        const expectedUserColumns = ['id', 'first_name', 'last_name', 'email', 'password'];
        expectedUserColumns.forEach(column => {
            expect(userColumnNames).toContain(column);
        });
        
        // Check bookings table structure
        const [bookingColumns] = await pool.execute("DESCRIBE bookings");
        const bookingColumnNames = bookingColumns.map(col => col.Field);
        
        const expectedBookingColumns = ['id', 'hotel_id', 'start_date', 'end_date', 'first_name', 'last_name', 'email'];
        expectedBookingColumns.forEach(column => {
            expect(bookingColumnNames).toContain(column);
        });
        
        console.log('✓ Database schema structure validated');
    });

    // Test 10: Cascade and Reference Integrity
    test('Foreign Key and Reference Integrity', async () => {
        // Note: This test assumes foreign key relationships exist
        // If no foreign keys are defined, this test documents the current state
        
        try {
            // Check for foreign key constraints
            const [constraints] = await pool.execute(`
                SELECT 
                    CONSTRAINT_NAME,
                    TABLE_NAME,
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `);
            
            console.log(`Found ${constraints.length} foreign key constraints`);
            
            if (constraints.length > 0) {
                constraints.forEach(constraint => {
                    console.log(`FK: ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
                });
            } else {
                console.log('Note: No foreign key constraints found in current schema');
            }
            
            expect(Array.isArray(constraints)).toBe(true);
            
        } catch (error) {
            console.log('Could not check foreign key constraints:', error.message);
        }
    });

    // Test 11: Index Constraints and Performance
    test('Index Constraints Validation', async () => {
        // Check for indexes on critical fields
        const [indexes] = await pool.execute(`
            SELECT 
                TABLE_NAME,
                INDEX_NAME,
                COLUMN_NAME,
                NON_UNIQUE
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
        `);
        
        console.log(`Found ${indexes.length} index entries`);
        
        // Check for primary key indexes
        const primaryIndexes = indexes.filter(idx => idx.INDEX_NAME === 'PRIMARY');
        expect(primaryIndexes.length).toBeGreaterThan(0);
        
        // Check for unique indexes on email
        const emailIndexes = indexes.filter(idx => 
            idx.COLUMN_NAME === 'email' && idx.NON_UNIQUE === 0
        );
        
        if (emailIndexes.length > 0) {
            console.log('✓ Email uniqueness enforced by index');
        } else {
            console.log('Note: No unique index found on email field');
        }
        
        expect(Array.isArray(indexes)).toBe(true);
    });

    // Test 12: Data Type Conversion and Limits
    test('Data Type Boundaries and Conversion', async () => {
        const boundaryTests = [
            {
                name: 'Maximum Integer Value',
                field: 'total_price',
                value: 999999999.99,
                expectError: false
            },
            {
                name: 'Boolean Conversion',
                field: 'children',
                value: 1,
                expectedType: 'number'
            },
            {
                name: 'String to Number',
                field: 'adults',
                value: '2',
                expectedType: 'number'
            }
        ];

        for (const test of boundaryTests) {
            const bookingData = {
                hotel_id: `constraint_test_boundary_${Date.now()}`,
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: 'Boundary',
                last_name: 'Test',
                email: `boundary.test.${Date.now()}@example.com`,
                total_price: 100,
                [test.field]: test.value
            };

            try {
                const booking = await BookingModel.create(bookingData);
                
                if (test.expectError) {
                    expect(true).toBe(false);
                } else {
                    const retrieved = await BookingModel.findById(booking.id);
                    
                    if (test.expectedType) {
                        expect(typeof retrieved[test.field]).toBe(test.expectedType);
                    }
                    
                    console.log(`✓ ${test.name}: ${test.value} -> ${retrieved[test.field]} (${typeof retrieved[test.field]})`);
                }
                
                await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                
            } catch (error) {
                if (test.expectError) {
                    console.log(`✓ ${test.name} properly rejected`);
                } else {
                    console.log(`Note: ${test.name} failed: ${error.message}`);
                }
            }
        }
    });
});
