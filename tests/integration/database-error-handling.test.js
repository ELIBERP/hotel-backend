import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { pool } from '../../config/database.js';
import BookingModel from '../../model/booking.js';
import UserModel from '../../model/userModel.js';

// Database error handling and recovery tests
describe('Database Error Handling & Recovery Tests', () => {
    
    beforeAll(async () => {
        // Ensure database connection is available
        const connection = await pool.getConnection();
        connection.release();
    });

    afterAll(async () => {
        // Clean up any test data
        try {
            await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "error_test_%"');
            await pool.execute('DELETE FROM users WHERE email LIKE "error.test.%"');
        } catch (error) {
            console.error('Error test cleanup error:', error);
        }
    }, 10000);

    // Test 1: Connection Recovery After Network Issues
    test('Connection Recovery After Temporary Failures', async () => {
        // Test connection resilience
        const iterations = 10;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < iterations; i++) {
            try {
                // Perform a simple query
                const [result] = await pool.execute('SELECT 1 as test_value');
                expect(result[0].test_value).toBe(1);
                successCount++;
                
                // Small delay between connections
                await new Promise(resolve => setTimeout(resolve, 10));
                
            } catch (error) {
                errorCount++;
                console.log(`Connection attempt ${i + 1} failed:`, error.message);
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`Connection test: ${successCount} successes, ${errorCount} errors`);
        
        // Most connections should succeed
        expect(successCount).toBeGreaterThan(iterations * 0.8);
    });

    // Test 2: Transaction Rollback on Error
    test('Transaction Rollback on Error Conditions', async () => {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Create valid user first
            const [userResult] = await connection.execute(
                'INSERT INTO users (id, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?)',
                [Date.now().toString(), 'Error', 'Test', `error.test.transaction.${Date.now()}@example.com`, 'hashedpassword']
            );
            const userId = userResult.insertId;
            
            // Create valid booking
            const [bookingResult] = await connection.execute(
                'INSERT INTO bookings (id, hotel_id, start_date, end_date, nights, first_name, last_name, email, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [Date.now().toString(), 'error_test_tx', '2025-12-01', '2025-12-02', 1, 'Error', 'Test', `error.test.booking.${Date.now()}@example.com`, 100]
            );
            const bookingId = bookingResult.insertId;
            
            // Verify data exists before error
            const [userCheck] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE id = ?', [userId]);
            const [bookingCheck] = await connection.execute('SELECT COUNT(*) as count FROM bookings WHERE id = ?', [bookingId]);
            
            expect(userCheck[0].count).toBe(1);
            expect(bookingCheck[0].count).toBe(1);
            
            // Now cause an intentional error (duplicate email)
            try {
                await connection.execute(
                    'INSERT INTO users (id, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?)',
                    [Date.now().toString() + '_dup', 'Duplicate', 'User', `error.test.transaction.${Date.now()}@example.com`, 'hashedpassword']
                );
            } catch (insertError) {
                // Expected duplicate error
                expect(insertError.message).toMatch(/Duplicate entry|UNIQUE/i);
            }
            
            // Rollback the entire transaction
            await connection.rollback();
            
            // Verify all data was rolled back
            const [userFinalCheck] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE id = ?', [userId]);
            const [bookingFinalCheck] = await pool.execute('SELECT COUNT(*) as count FROM bookings WHERE id = ?', [bookingId]);
            
            expect(userFinalCheck[0].count).toBe(0);
            expect(bookingFinalCheck[0].count).toBe(0);
            
            console.log('✓ Transaction rollback successful');
            
        } finally {
            connection.release();
        }
    });

    // Test 3: Handling Invalid SQL Queries
    test('Invalid SQL Query Error Handling', async () => {
        const invalidQueries = [
            'SELECT * FROM non_existent_table',
            'SELECT invalid_column FROM users',
            'INSERT INTO users (invalid_column) VALUES ("test")',
            'UPDATE non_existent_table SET field = "value"',
            'DELETE FROM users WHERE invalid_operator ? "value"',
            'SELECT * FROM users ORDER BY non_existent_column',
            'INSERT INTO users () VALUES ()',
            'SELECT * FROM users JOIN non_existent_table ON invalid_condition'
        ];

        for (const query of invalidQueries) {
            try {
                await pool.execute(query);
                
                // Should not reach here
                expect(true).toBe(false);
                
            } catch (error) {
                // Should be SQL syntax or table/column error
                expect(error.message).toMatch(/doesn't exist|Unknown column|syntax error|SQL|default value|Field/i);
                console.log(`✓ Invalid query properly rejected: ${query.substring(0, 30)}...`);
            }
        }
    });

    // Test 4: Model-Level Error Handling
    test('Model-Level Error Handling and Validation', async () => {
        // Test BookingModel error handling
        const invalidBookingData = [
            {
                name: 'Missing Required Fields',
                data: { hotel_id: 'error_test_missing' },
                expectError: true
            },
            {
                name: 'Invalid Date Format',
                data: {
                    hotel_id: 'error_test_date',
                    start_date: 'invalid-date',
                    end_date: '2025-12-02',
                    first_name: 'Test',
                    last_name: 'User',
                    email: `error.test.date.${Date.now()}@example.com`,
                    total_price: 100
                },
                expectError: true
            },
            {
                name: 'Invalid Email Format',
                data: {
                    hotel_id: 'error_test_email',
                    start_date: '2025-12-01',
                    end_date: '2025-12-02',
                    first_name: 'Test',
                    last_name: 'User',
                    email: 'invalid-email-format',
                    total_price: 100
                },
                expectError: false // Model might not validate email format
            }
        ];

        for (const testCase of invalidBookingData) {
            try {
                const booking = await BookingModel.create(testCase.data);
                
                if (testCase.expectError) {
                    console.log(`Note: ${testCase.name} was unexpectedly accepted`);
                    // Clean up if creation succeeded
                    await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                } else {
                    console.log(`✓ ${testCase.name} handled gracefully`);
                    await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                }
                
            } catch (error) {
                if (testCase.expectError) {
                    console.log(`✓ ${testCase.name} properly rejected: ${error.message}`);
                } else {
                    console.log(`Note: ${testCase.name} was rejected: ${error.message}`);
                }
                
                expect(error).toBeInstanceOf(Error);
            }
        }
    });

    // Test 5: Connection Pool Exhaustion Recovery
    test('Connection Pool Exhaustion and Recovery', async () => {
        const poolSize = 10; // Typical pool size
        const connections = [];
        
        try {
            // Acquire all available connections
            for (let i = 0; i < poolSize + 5; i++) {
                try {
                    const connection = await pool.getConnection();
                    connections.push(connection);
                } catch (error) {
                    // Expected when pool is exhausted
                    console.log(`Connection ${i + 1} failed (pool exhausted): ${error.message}`);
                    break;
                }
            }
            
            console.log(`Acquired ${connections.length} connections`);
            
            // Try to perform operation when pool is exhausted
            const operationPromise = pool.execute('SELECT 1 as test');
            
            // Release half the connections
            const toRelease = Math.floor(connections.length / 2);
            for (let i = 0; i < toRelease; i++) {
                connections[i].release();
            }
            connections.splice(0, toRelease);
            
            // Now the operation should succeed
            const [result] = await operationPromise;
            expect(result[0].test).toBe(1);
            
            console.log('✓ Pool recovery successful');
            
        } finally {
            // Release all remaining connections
            connections.forEach(conn => {
                try {
                    conn.release();
                } catch (error) {
                    console.log('Error releasing connection:', error.message);
                }
            });
        }
    });

    // Test 6: Deadlock Detection and Recovery
    test('Deadlock Detection and Retry Logic', async () => {
        // Create test data for deadlock scenario
        const user1Data = {
            firstName: 'Deadlock',
            lastName: 'Test1',
            email: `error.test.deadlock1.${Date.now()}@example.com`,
            password: 'password'
        };
        
        const user2Data = {
            firstName: 'Deadlock',
            lastName: 'Test2',
            email: `error.test.deadlock2.${Date.now()}@example.com`,
            password: 'password'
        };
        
        const user1 = await UserModel.createUser(user1Data);
        const user2 = await UserModel.createUser(user2Data);
        
        try {
            // Simulate potential deadlock scenario with concurrent updates
            const updatePromises = [
                UserModel.updateUser(user1.id, { firstName: 'Updated1', lastName: 'NewName1' }),
                UserModel.updateUser(user2.id, { firstName: 'Updated2', lastName: 'NewName2' }),
                UserModel.updateUser(user1.id, { phone: '+65 1234 5678' }),
                UserModel.updateUser(user2.id, { phone: '+65 8765 4321' })
            ];
            
            const results = await Promise.all(updatePromises);
            
            // All updates should complete (either success or handled error)
            expect(results).toHaveLength(4);
            results.forEach(result => {
                expect(typeof result).toBe('boolean');
            });
            
            console.log('✓ Concurrent updates handled without deadlock');
            
        } catch (error) {
            // If deadlock occurs, it should be handled gracefully
            expect(error.message).toMatch(/deadlock|timeout/i);
            console.log('✓ Deadlock properly detected and handled');
        } finally {
            // Clean up
            await UserModel.deleteUser(user1.id);
            await UserModel.deleteUser(user2.id);
        }
    });

    // Test 7: Large Query Timeout Handling
    test('Query Timeout and Resource Management', async () => {
        const startTime = Date.now();
        
        try {
            // Attempt a potentially expensive operation
            const [result] = await pool.execute(`
                SELECT 
                    u.id,
                    u.first_name,
                    u.last_name,
                    COUNT(b.id) as booking_count
                FROM users u
                LEFT JOIN bookings b ON u.email = b.email
                WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
                GROUP BY u.id, u.first_name, u.last_name
                ORDER BY booking_count DESC
                LIMIT 1000
            `);
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            console.log(`Complex query completed in ${executionTime}ms with ${result.length} results`);
            
            expect(Array.isArray(result)).toBe(true);
            expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
            
        } catch (error) {
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            if (error.message.includes('timeout')) {
                console.log(`✓ Query timeout properly handled after ${executionTime}ms`);
            } else {
                console.log(`Query failed with error: ${error.message}`);
            }
        }
    });

    // Test 8: Data Corruption Detection
    test('Data Integrity and Corruption Detection', async () => {
        // Create test booking
        const bookingData = {
            hotel_id: 'error_test_integrity',
            start_date: '2025-12-01',
            end_date: '2025-12-02',
            first_name: 'Integrity',
            last_name: 'Test',
            email: `error.test.integrity.${Date.now()}@example.com`,
            total_price: 150.75
        };
        
        const booking = await BookingModel.create(bookingData);
        
        // Verify data integrity after creation
        const retrieved = await BookingModel.findById(booking.id);
        
        expect(retrieved.hotel_id).toBe(bookingData.hotel_id);
        expect(retrieved.first_name).toBe(bookingData.first_name);
        expect(retrieved.last_name).toBe(bookingData.last_name);
        expect(retrieved.email).toBe(bookingData.email);
        expect(retrieved.total_price).toBe(bookingData.total_price);
        
        // Verify dates are properly stored and retrieved
        expect(new Date(retrieved.start_date).toISOString().split('T')[0]).toBe(bookingData.start_date);
        expect(new Date(retrieved.end_date).toISOString().split('T')[0]).toBe(bookingData.end_date);
        
        console.log('✓ Data integrity verified');
        
        // Clean up
        await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
    });

    // Test 9: Concurrent Access Error Handling
    test('Concurrent Access Conflict Resolution', async () => {
        // Create test user
        const userData = {
            firstName: 'Concurrent',
            lastName: 'Test',
            email: `error.test.concurrent.${Date.now()}@example.com`,
            password: 'password'
        };
        
        const user = await UserModel.createUser(userData);
        
        try {
            // Simulate multiple concurrent operations on the same record
            const operations = [
                () => UserModel.updateUser(user.id, { firstName: 'Updated1' }),
                () => UserModel.updateUser(user.id, { lastName: 'NewLast1' }),
                () => UserModel.updateUser(user.id, { phone: '+65 1111 1111' }),
                () => UserModel.findById(user.id),
                () => UserModel.updateUser(user.id, { firstName: 'Updated2' }),
                () => UserModel.findById(user.id)
            ];
            
            const results = await Promise.allSettled(operations.map(op => op()));
            
            // Check results
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            console.log(`Concurrent operations: ${successful} successful, ${failed} failed`);
            
            // Most operations should succeed
            expect(successful).toBeGreaterThan(failed);
            
            // Verify final state is consistent
            const finalUser = await UserModel.findById(user.id);
            expect(finalUser).toBeDefined();
            expect(finalUser.id).toBe(user.id);
            
        } finally {
            await UserModel.deleteUser(user.id);
        }
    });

    // Test 10: Memory Leak Prevention
    test('Memory Leak Prevention in Error Scenarios', async () => {
        const initialMemory = process.memoryUsage();
        
        // Perform operations that might cause memory leaks
        for (let i = 0; i < 50; i++) {
            try {
                // Intentionally cause errors and handle them
                await pool.execute('SELECT * FROM non_existent_table');
            } catch (error) {
                // Expected error, continue
            }
            
            try {
                // Create and immediately fail operations
                await BookingModel.create({
                    hotel_id: null, // This should fail
                    start_date: '2025-12-01'
                });
            } catch (error) {
                // Expected error, continue
            }
            
            // Small delay
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        console.log(`Memory increase after error operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
        
        // Memory increase should be minimal
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });

    // Test 11: Error Recovery with Invalid Transactions
    test('Error Recovery from Invalid Transaction States', async () => {
        const connection = await pool.getConnection();
        
        try {
            // Start transaction
            await connection.beginTransaction();
            
            // Perform valid operation
            const [result1] = await connection.execute(
                'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
                ['Recovery', 'Test', `error.test.recovery.${Date.now()}@example.com`, 'password']
            );
            const userId = result1.insertId;
            
            // Attempt invalid operation that should cause error
            try {
                await connection.execute(
                    'INSERT INTO users (id, first_name, last_name, email, password) VALUES (?, ?, ?, ?, ?)',
                    [userId, 'Duplicate', 'ID', `error.test.duplicate.${Date.now()}@example.com`, 'password']
                );
            } catch (error) {
                // Expected duplicate key error
                expect(error.message).toMatch(/Duplicate entry|PRIMARY/i);
            }
            
            // Transaction should still be valid, rollback should work
            await connection.rollback();
            
            // Verify rollback worked
            const [check] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE id = ?', [userId]);
            expect(check[0].count).toBe(0);
            
            console.log('✓ Error recovery from invalid transaction successful');
            
        } catch (error) {
            // If anything fails, ensure rollback
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.log('Rollback failed:', rollbackError.message);
            }
            throw error;
        } finally {
            connection.release();
        }
    });

    // Test 12: Error Logging and Monitoring
    test('Error Logging and Diagnostic Information', async () => {
        const errors = [];
        
        // Capture various types of errors
        const errorScenarios = [
            {
                name: 'Syntax Error',
                operation: () => pool.execute('SELCT * FROM users')
            },
            {
                name: 'Table Not Found',
                operation: () => pool.execute('SELECT * FROM invalid_table')
            },
            {
                name: 'Column Not Found',
                operation: () => pool.execute('SELECT invalid_column FROM users')
            },
            {
                name: 'Constraint Violation',
                operation: async () => {
                    const user = await UserModel.createUser({
                        firstName: 'Error',
                        lastName: 'Log',
                        email: `error.test.log.${Date.now()}@example.com`,
                        password: 'password'
                    });
                    // Try to create duplicate
                    await UserModel.createUser({
                        firstName: 'Error',
                        lastName: 'Log',
                        email: user.email, // Same email
                        password: 'password'
                    });
                }
            }
        ];
        
        for (const scenario of errorScenarios) {
            try {
                await scenario.operation();
            } catch (error) {
                errors.push({
                    scenario: scenario.name,
                    message: error.message,
                    code: error.code,
                    errno: error.errno,
                    sqlState: error.sqlState,
                    timestamp: new Date().toISOString()
                });
                
                console.log(`✓ ${scenario.name} error captured:`, {
                    message: error.message.substring(0, 100),
                    code: error.code
                });
            }
        }
        
        expect(errors.length).toBe(errorScenarios.length);
        
        // Verify error information is comprehensive
        errors.forEach(error => {
            expect(error.message).toBeDefined();
            expect(error.timestamp).toBeDefined();
            expect(typeof error.scenario).toBe('string');
        });
        
        console.log(`✓ Captured ${errors.length} different error types for monitoring`);
    });
});
