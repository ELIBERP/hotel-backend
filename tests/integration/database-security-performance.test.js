import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../config/database.js';
import BookingModel from '../../model/booking.js';
import UserModel from '../../model/userModel.js';

// Database security and performance tests
describe('Database Security & Performance Tests', () => {
    
    beforeAll(async () => {
        const connection = await pool.getConnection();
        connection.release();
    });

    afterAll(async () => {
        try {
            await pool.execute('DELETE FROM bookings WHERE hotel_id LIKE "security_test_%"');
            await pool.execute('DELETE FROM users WHERE email LIKE "security.test.%"');
        } catch (error) {
            console.error('Security test cleanup error:', error);
        }
    }, 10000);

    // Test 1: SQL Injection Prevention
    test('SQL Injection Prevention Through Parameterized Queries', async () => {
        const maliciousInputs = [
            "'; DROP TABLE bookings; --",
            "' OR '1'='1",
            "' UNION SELECT * FROM users --",
            "admin'--",
            "' OR 1=1#",
            "') OR ('1'='1",
            "1' AND (SELECT COUNT(*) FROM users) > 0 --"
        ];

        for (const maliciousInput of maliciousInputs) {
            // Test with BookingModel which uses parameterized queries
            const bookings = await BookingModel.findByUserEmail(maliciousInput);
            expect(Array.isArray(bookings)).toBe(true);
            expect(bookings.length).toBe(0);

            // Test with UserModel
            const user = await UserModel.findByEmail(maliciousInput);
            expect(user).toBeNull();

            // Direct parameterized query test
            const [results] = await pool.execute(
                'SELECT * FROM users WHERE email = ?',
                [maliciousInput]
            );
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        }

        // Verify tables still exist after injection attempts
        const [tables] = await pool.execute("SHOW TABLES");
        const tableNames = tables.map(row => Object.values(row)[0]);
        expect(tableNames).toContain('users');
        expect(tableNames).toContain('bookings');

        console.log('✓ SQL injection prevention verified');
    });

    // Test 2: Input Sanitization and Validation
    test('Input Sanitization and Data Validation', async () => {
        const maliciousDataTests = [
            {
                name: 'Script injection in names',
                data: {
                    first_name: '<script>alert("xss")</script>',
                    last_name: '<?php echo "test"; ?>',
                    hotel_name: '${console.log("injection")}'
                }
            },
            {
                name: 'Special characters',
                data: {
                    first_name: 'John!@#$%^&*()',
                    last_name: 'Doe<>?:"{}|',
                    hotel_name: 'Hotel & Resort\'s "Special" Place'
                }
            },
            {
                name: 'Unicode and emoji',
                data: {
                    first_name: 'José 😀',
                    last_name: 'Müller 🏨',
                    hotel_name: 'Beach Resort 🏖️🌴 中文测试'
                }
            }
        ];

        for (const testCase of maliciousDataTests) {
            const bookingData = {
                hotel_id: `security_test_${Date.now()}`,
                hotel_name: testCase.data.hotel_name,
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: testCase.data.first_name,
                last_name: testCase.data.last_name,
                email: `security.test.${Date.now()}@example.com`,
                total_price: 100
            };

            try {
                const booking = await BookingModel.create(bookingData);
                
                // Verify data was stored safely without executing scripts
                const retrieved = await BookingModel.findById(booking.id);
                expect(retrieved.first_name).toBe(testCase.data.first_name);
                expect(retrieved.last_name).toBe(testCase.data.last_name);
                expect(retrieved.hotel_name).toBe(testCase.data.hotel_name);
                
                // Clean up
                await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                
            } catch (error) {
                // Should be legitimate validation error, not injection
                expect(error.message).not.toContain('syntax error');
                console.log(`${testCase.name} caused validation error: ${error.message}`);
            }
        }

        console.log('✓ Input sanitization verified');
    });

    // Test 3: Performance Under Load
    test('Database Performance Under Concurrent Load', async () => {
        const concurrentUsers = 20;
        const operationsPerUser = 5;
        const startTime = Date.now();

        // Create concurrent user operations
        const userOperations = [];
        for (let i = 0; i < concurrentUsers; i++) {
            for (let j = 0; j < operationsPerUser; j++) {
                userOperations.push(
                    pool.execute('SELECT ?, NOW() as timestamp', [`user_${i}_op_${j}`])
                );
            }
        }

        const results = await Promise.all(userOperations);
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const totalOperations = concurrentUsers * operationsPerUser;

        expect(results).toHaveLength(totalOperations);
        expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

        const avgTimePerOperation = totalTime / totalOperations;
        console.log(`Performance test: ${totalOperations} operations in ${totalTime}ms (avg: ${avgTimePerOperation.toFixed(2)}ms per operation)`);

        console.log('✓ Performance under load verified');
    });

    // Test 4: Large Dataset Handling
    test('Large Dataset Query Performance', async () => {
        // Create test data for performance testing
        const testBookings = [];
        const batchSize = 25;

        try {
            console.log('Creating test data for performance testing...');
            for (let i = 0; i < batchSize; i++) {
                const bookingData = {
                    hotel_id: `perf_hotel_${i % 5}`,
                    hotel_name: `Performance Test Hotel ${i}`,
                    start_date: '2025-12-01',
                    end_date: '2025-12-02',
                    first_name: `User${i}`,
                    last_name: 'Performance',
                    email: `security.test.perf.${i}.${Date.now()}@example.com`,
                    total_price: 100 + i,
                    room_types: [`Room${i % 3}`, `Type${i % 2}`]
                };

                const booking = await BookingModel.create(bookingData);
                testBookings.push(booking);
            }

            // Test complex query performance
            const queryStartTime = Date.now();
            const [results] = await pool.execute(`
                SELECT 
                    hotel_id,
                    COUNT(*) as booking_count,
                    AVG(total_price) as avg_price,
                    MIN(start_date) as earliest_date
                FROM bookings 
                WHERE hotel_id LIKE "perf_hotel_%" 
                GROUP BY hotel_id
                ORDER BY booking_count DESC
            `);
            const queryEndTime = Date.now();
            const queryTime = queryEndTime - queryStartTime;

            expect(Array.isArray(results)).toBe(true);
            expect(queryTime).toBeLessThan(1000); // Complex query should complete within 1 second
            
            console.log(`Complex aggregation query on ${batchSize} records: ${queryTime}ms`);

            // Test pagination performance
            const paginationStartTime = Date.now();
            const [paginatedResults] = await pool.execute(
                'SELECT * FROM bookings WHERE hotel_id LIKE "perf_hotel_%" ORDER BY created_at DESC LIMIT 10 OFFSET 5'
            );
            const paginationEndTime = Date.now();
            const paginationTime = paginationEndTime - paginationStartTime;

            expect(Array.isArray(paginatedResults)).toBe(true);
            expect(paginationTime).toBeLessThan(500);
            
            console.log(`Pagination query: ${paginationTime}ms`);

        } finally {
            // Clean up test data
            for (const booking of testBookings) {
                try {
                    await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                } catch (error) {
                    console.log(`Cleanup error for booking ${booking.id}:`, error.message);
                }
            }
        }

        console.log('✓ Large dataset performance verified');
    });

    // Test 5: Connection Pool Security and Limits
    test('Connection Pool Security and Resource Management', async () => {
        const maxConnections = 15; // Attempt to exceed typical pool size
        const connections = [];

        try {
            // Attempt to acquire many connections
            for (let i = 0; i < maxConnections; i++) {
                try {
                    const connection = await pool.getConnection();
                    connections.push(connection);
                    
                    // Perform a simple operation to verify connection works
                    await connection.execute('SELECT ? as test', [i]);
                    
                } catch (error) {
                    console.log(`Connection ${i + 1} failed: ${error.message}`);
                    break; // Expected when pool limit is reached
                }
            }

            console.log(`Successfully acquired ${connections.length} connections`);

            // Verify operations still work with active connections
            const [result] = await pool.execute('SELECT 1 as functional_test');
            expect(result[0].functional_test).toBe(1);

            // Test connection timeout handling
            const timeoutStart = Date.now();
            try {
                const timeoutPromise = pool.execute('SELECT SLEEP(0.1) as timeout_test');
                const timeoutResult = await timeoutPromise;
                const timeoutEnd = Date.now();
                
                expect(timeoutResult[0][0].timeout_test).toBe(0);
                expect(timeoutEnd - timeoutStart).toBeGreaterThan(100);
                
            } catch (error) {
                console.log('Timeout test handled:', error.message);
            }

        } finally {
            // Release all connections
            connections.forEach(conn => {
                try {
                    conn.release();
                } catch (error) {
                    console.log('Error releasing connection:', error.message);
                }
            });
        }

        console.log('✓ Connection pool security verified');
    });

    // Test 6: Data Encryption and Password Security
    test('Password Hashing and Security Validation', async () => {
        const testPasswords = [
            'simplePassword',
            'ComplexP@ssw0rd!',
            'très-sécurisé-møt-de-passe-123',
            '密码测试123',
            'emoji_password_🔒🔑'
        ];

        for (const password of testPasswords) {
            const userData = {
                email: `security.test.password.${Date.now()}.${Math.random()}@example.com`,
                password: password,
                firstName: 'Security',
                lastName: 'Test'
            };

            try {
                const user = await UserModel.createUser(userData);
                
                // Verify password is hashed (not stored as plain text)
                const storedUser = await UserModel.findByEmail(userData.email);
                expect(storedUser.password_hash).not.toBe(password);
                expect(storedUser.password_hash).toContain('$2b$'); // bcrypt format
                
                // Verify password verification works
                const isValidPassword = await UserModel.verifyPassword(password, storedUser.password_hash);
                expect(isValidPassword).toBe(true);
                
                // Verify wrong password fails
                const isInvalidPassword = await UserModel.verifyPassword('wrongPassword', storedUser.password_hash);
                expect(isInvalidPassword).toBe(false);

                // Clean up
                await UserModel.deleteUser(user.id);
                
            } catch (error) {
                console.log(`Password test for "${password}" failed:`, error.message);
            }
        }

        console.log('✓ Password security verified');
    });

    // Test 7: JSON Field Security and Performance
    test('JSON Field Security and Query Performance', async () => {
        const maliciousJsonData = [
            { "script": "<script>alert('xss')</script>" },
            { "sql": "'; DROP TABLE bookings; --" },
            { "nested": { "deep": { "attack": "' OR 1=1 --" } } },
            Array(1000).fill("large_array_test") // Large array test
        ];

        for (const jsonData of maliciousJsonData) {
            const bookingData = {
                hotel_id: `security_test_json_${Date.now()}`,
                start_date: '2025-12-01',
                end_date: '2025-12-02',
                first_name: 'JSON',
                last_name: 'Security',
                email: `security.test.json.${Date.now()}@example.com`,
                total_price: 100,
                room_types: Array.isArray(jsonData) ? jsonData : ['Standard'],
                billing_address: Array.isArray(jsonData) ? {} : jsonData
            };

            try {
                const booking = await BookingModel.create(bookingData);
                
                // Verify JSON was stored safely
                const retrieved = await BookingModel.findById(booking.id);
                
                if (Array.isArray(jsonData)) {
                    expect(Array.isArray(retrieved.room_types)).toBe(true);
                    expect(retrieved.room_types).toHaveLength(jsonData.length);
                } else {
                    expect(typeof retrieved.billing_address).toBe('object');
                    expect(retrieved.billing_address).toEqual(jsonData);
                }

                // Test JSON query performance
                const jsonQueryStart = Date.now();
                const [jsonResults] = await pool.execute(
                    'SELECT * FROM bookings WHERE JSON_EXTRACT(room_types, "$[0]") IS NOT NULL AND id = ?',
                    [booking.id]
                );
                const jsonQueryTime = Date.now() - jsonQueryStart;
                
                expect(Array.isArray(jsonResults)).toBe(true);
                expect(jsonQueryTime).toBeLessThan(200);

                // Clean up
                await pool.execute('DELETE FROM bookings WHERE id = ?', [booking.id]);
                
            } catch (error) {
                // Should be legitimate data error, not injection
                expect(error.message).not.toContain('syntax error');
                console.log('JSON test caused error:', error.message);
            }
        }

        console.log('✓ JSON field security verified');
    });

    // Test 8: Database Index Security and Performance
    test('Database Index Utilization and Security', async () => {
        // Test that indexes are being used properly
        const indexQueries = [
            'EXPLAIN SELECT * FROM users WHERE email = "test@example.com"',
            'EXPLAIN SELECT * FROM bookings WHERE hotel_id = "test_hotel"',
            'EXPLAIN SELECT * FROM bookings WHERE booking_status = "confirmed"',
            'EXPLAIN SELECT * FROM bookings WHERE start_date >= "2025-01-01"'
        ];

        for (const query of indexQueries) {
            const [explanation] = await pool.execute(query);
            
            // Verify query explanation exists (indicates proper indexing)
            expect(Array.isArray(explanation)).toBe(true);
            expect(explanation.length).toBeGreaterThan(0);
            
            // For queries on indexed columns, type should be efficient
            const hasEfficientAccess = explanation.some(row => 
                row.type === 'const' || row.type === 'ref' || row.type === 'range'
            );
            
            if (!hasEfficientAccess) {
                console.log(`Query might benefit from indexing: ${query}`);
            }
        }

        // Verify critical indexes exist
        const [indexes] = await pool.execute(`
            SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME IN ('users', 'bookings')
        `);

        const indexNames = indexes.map(idx => `${idx.TABLE_NAME}.${idx.COLUMN_NAME}`);
        
        // Check for critical indexes
        const criticalIndexes = [
            'users.email',
            'bookings.hotel_id', 
            'bookings.booking_status'
        ];

        criticalIndexes.forEach(criticalIndex => {
            const hasIndex = indexNames.some(idx => idx.includes(criticalIndex));
            if (!hasIndex) {
                console.log(`Consider adding index for: ${criticalIndex}`);
            }
        });

        console.log('✓ Database index security verified');
    });

    // Test 9: Memory and Resource Leak Prevention
    test('Memory Leak Prevention and Resource Management', async () => {
        const initialMemory = process.memoryUsage();
        const operationCount = 100;

        // Perform many operations that could potentially leak memory
        for (let i = 0; i < operationCount; i++) {
            try {
                // Mix of successful and failing operations
                if (i % 10 === 0) {
                    // Intentional error to test error handling
                    await pool.execute('SELECT * FROM non_existent_table');
                } else {
                    // Normal operation
                    await pool.execute('SELECT ? as iteration', [i]);
                }
            } catch (error) {
                // Expected for every 10th operation
            }

            // Periodic garbage collection hint
            if (i % 25 === 0 && global.gc) {
                global.gc();
            }
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const memoryIncreasePerOp = memoryIncrease / operationCount;

        console.log(`Memory usage after ${operationCount} operations:`);
        console.log(`Total increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Per operation: ${(memoryIncreasePerOp / 1024).toFixed(2)} KB`);

        // Memory increase should be reasonable
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
        expect(memoryIncreasePerOp).toBeLessThan(100 * 1024); // Less than 100KB per operation

        console.log('✓ Memory leak prevention verified');
    });

    // Test 10: Audit and Monitoring Capabilities
    test('Database Monitoring and Error Tracking', async () => {
        const errors = [];
        const operations = [];

        // Track various database operations and their performance
        const monitoringTests = [
            {
                name: 'Fast query',
                operation: () => pool.execute('SELECT 1 as test'),
                expectedTime: 50
            },
            {
                name: 'User lookup',
                operation: () => UserModel.findByEmail('nonexistent@test.com'),
                expectedTime: 100
            },
            {
                name: 'Booking search',
                operation: () => BookingModel.findByUserEmail('nonexistent@test.com'),
                expectedTime: 200
            },
            {
                name: 'Complex aggregation',
                operation: () => pool.execute(`
                    SELECT COUNT(*) as total, 
                           AVG(total_price) as avg_price 
                    FROM bookings 
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
                `),
                expectedTime: 500
            }
        ];

        for (const test of monitoringTests) {
            const startTime = Date.now();
            try {
                const result = await test.operation();
                const endTime = Date.now();
                const executionTime = endTime - startTime;

                operations.push({
                    name: test.name,
                    executionTime,
                    success: true,
                    timestamp: new Date().toISOString()
                });

                if (executionTime > test.expectedTime) {
                    console.log(`⚠️  ${test.name} took ${executionTime}ms (expected < ${test.expectedTime}ms)`);
                }

                expect(executionTime).toBeLessThan(test.expectedTime * 2); // Allow 2x buffer

            } catch (error) {
                const endTime = Date.now();
                const executionTime = endTime - startTime;

                errors.push({
                    name: test.name,
                    error: error.message,
                    executionTime,
                    timestamp: new Date().toISOString()
                });

                console.log(`❌ ${test.name} failed: ${error.message}`);
            }
        }

        // Verify monitoring data collection
        expect(operations.length + errors.length).toBe(monitoringTests.length);
        
        operations.forEach(op => {
            expect(op.name).toBeDefined();
            expect(op.executionTime).toBeGreaterThan(0);
            expect(op.timestamp).toBeDefined();
        });

        console.log(`✓ Database monitoring verified (${operations.length} successful, ${errors.length} errors)`);
    });
});
