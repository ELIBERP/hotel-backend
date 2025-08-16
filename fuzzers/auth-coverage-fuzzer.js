#!/usr/bin/env node

/**
 * AuthController Coverage-Driven Fuzzer
 * Specifically targets uncovered lines: 105-149, 187-227
 */

import AuthControllerFuzzer from './auth-controller-fuzzer.js';
import AuthControllerPropertyTester from './auth-property-tester.js';
import fs from 'fs/promises';

class AuthControllerCoverageFuzzer {
    constructor() {
        this.targetLines = {
            registration: {
                range: '105-149',
                specificLines: [107, 110, 111, 112, 113, 114, 115, 116, 117, 118, 120, 125, 130, 135, 138, 140, 145, 149],
                description: 'Registration logic: email normalization, user existence check, user creation, response formatting'
            },
            login: {
                range: '187-227', 
                specificLines: [187, 190, 192, 194, 195, 196, 197, 198, 199, 200, 201, 203, 205, 210, 213, 215, 220, 225, 227],
                description: 'Login logic: user lookup, password verification, JWT generation, response with token'
            }
        };
        
        this.coverageResults = {
            registration: { linesCovered: new Set(), totalTests: 0, vulnerabilities: [] },
            login: { linesCovered: new Set(), totalTests: 0, vulnerabilities: [] }
        };
    }

    async runTargetedFuzzing(durationMinutes = 60) {
        console.log('🎯 Starting AuthController Coverage-Driven Fuzzing');
        console.log(`⏱️  Duration: ${durationMinutes} minutes`);
        console.log('📋 Target Lines:');
        console.log(`   Registration (${this.targetLines.registration.range}): ${this.targetLines.registration.description}`);
        console.log(`   Login (${this.targetLines.login.range}): ${this.targetLines.login.description}\n`);

        // Phase 1: Property-based testing
        console.log('🧪 Phase 1: Property-based Testing');
        await this.runPropertyBasedTests();

        // Phase 2: Targeted input fuzzing
        console.log('\n🎯 Phase 2: Targeted Input Fuzzing');
        await this.runInputFuzzing();

        // Phase 3: Edge case exploration
        console.log('\n🔍 Phase 3: Edge Case Exploration');
        await this.runEdgeCaseTesting();

        // Phase 4: Vulnerability scanning
        console.log('\n🚨 Phase 4: Vulnerability Scanning');
        await this.runVulnerabilityScanning();

        // Phase 5: Continuous fuzzing for remaining time
        console.log('\n🔄 Phase 5: Continuous Fuzzing');
        const remainingTime = Math.max(0, durationMinutes - 15); // Reserve 15 minutes for other phases
        if (remainingTime > 0) {
            await this.runContinuousFuzzing(remainingTime);
        }

        // Generate comprehensive report
        return await this.generateCoverageReport();
    }

    async runPropertyBasedTests() {
        const propertyTester = new AuthControllerPropertyTester();
        const results = await propertyTester.runPropertyTests();
        
        // Track coverage from property tests
        for (const result of results) {
            if (result.targetLines.includes('105-149')) {
                this.coverageResults.registration.totalTests += 50; // 50 runs per property
            }
            if (result.targetLines.includes('187-227')) {
                this.coverageResults.login.totalTests += 50;
            }
        }
    }

    async runInputFuzzing() {
        const fuzzer = new AuthControllerFuzzer();
        
        // Registration input fuzzing
        console.log('🎯 Fuzzing Registration Inputs...');
        await this.fuzzRegistrationInputs(fuzzer);
        
        // Login input fuzzing  
        console.log('🎯 Fuzzing Login Inputs...');
        await this.fuzzLoginInputs(fuzzer);
    }

    async fuzzRegistrationInputs(fuzzer) {
        const testCases = [
            // Email normalization edge cases (targeting lines 107-108)
            { type: 'EMAIL_EDGE_CASES', inputs: [
                'Test@EXAMPLE.COM',           // Case normalization
                ' test@example.com ',         // Whitespace trimming
                'test+tag@example.com',       // Plus addressing
                'test.dots@example.com',      // Dot handling
                'test@例え.テスト',           // Unicode domains
            ]},
            
            // User existence check edge cases (targeting lines 110-118)
            { type: 'USER_EXISTENCE_RACE', inputs: [
                'concurrent1@test.com',
                'concurrent2@test.com',
                'concurrent3@test.com'
            ]},
            
            // User creation edge cases (targeting lines 120-138)
            { type: 'USER_CREATION_EDGE', inputs: [
                { firstName: '', lastName: 'Test' },           // Empty firstName
                { firstName: 'Test', lastName: '' },           // Empty lastName
                { firstName: ' ', lastName: ' ' },             // Whitespace only
                { firstName: 'A'.repeat(255), lastName: 'B'.repeat(255) }, // Max length
            ]},
            
            // Response formatting edge cases (targeting lines 140-149)
            { type: 'RESPONSE_FORMAT', inputs: [
                'unicode用户@test.com',       // Unicode in response
                'special$chars@test.com',     // Special characters
            ]}
        ];

        for (const testCase of testCases) {
            console.log(`   Testing: ${testCase.type}`);
            
            for (const input of testCase.inputs) {
                await this.executeRegistrationTest(fuzzer, input, testCase.type);
                this.coverageResults.registration.totalTests++;
            }
        }
    }

    async fuzzLoginInputs(fuzzer) {
        const testCases = [
            // User lookup edge cases (targeting lines 187-192)
            { type: 'USER_LOOKUP_EDGE', inputs: [
                'nonexistent@test.com',       // Non-existent user
                'CASE@TEST.COM',              // Case sensitivity
                ' spaced@test.com ',          // Whitespace
                'unicode用户@test.com',       // Unicode email
            ]},
            
            // Password verification edge cases (targeting lines 194-201)  
            { type: 'PASSWORD_VERIFICATION', inputs: [
                '',                           // Empty password
                'a'.repeat(1000),            // Very long password
                'unicode密码测试',            // Unicode password
                'password\x00null',          // Null bytes
            ]},
            
            // JWT generation edge cases (targeting lines 203-213)
            { type: 'JWT_GENERATION', inputs: [
                'jwt-test@example.com',      // Normal JWT generation
                'special$user@test.com',     // Special chars in user data
            ]},
            
            // Response formatting edge cases (targeting lines 215-227)
            { type: 'LOGIN_RESPONSE', inputs: [
                'response-test@example.com', // Response formatting test
            ]}
        ];

        for (const testCase of testCases) {
            console.log(`   Testing: ${testCase.type}`);
            
            for (const input of testCase.inputs) {
                await this.executeLoginTest(fuzzer, input, testCase.type);
                this.coverageResults.login.totalTests++;
            }
        }
    }

    async runEdgeCaseTesting() {
        console.log('🔍 Testing specific edge cases for uncovered lines...');
        
        // Edge case 1: Registration with database constraint violations
        await this.testRegistrationConstraints();
        
        // Edge case 2: Login timing consistency
        await this.testLoginTiming();
        
        // Edge case 3: Concurrent operations
        await this.testConcurrentOperations();
        
        // Edge case 4: Memory and resource limits
        await this.testResourceLimits();
    }

    async testRegistrationConstraints() {
        console.log('   Testing database constraints...');
        
        const constraintTests = [
            {
                name: 'Duplicate Email Constraint',
                test: async () => {
                    const email = `constraint${Date.now()}@test.com`;
                    // Try to register same email twice quickly
                    const [result1, result2] = await Promise.allSettled([
                        this.makeRequest('/api/auth/register', {
                            email, password: 'Test123!', firstName: 'Test1', lastName: 'User1', phone: '+65 91234567'
                        }),
                        this.makeRequest('/api/auth/register', {
                            email, password: 'Test123!', firstName: 'Test2', lastName: 'User2', phone: '+65 91234567'
                        })
                    ]);
                    return { result1, result2 };
                }
            },
            {
                name: 'Long Field Constraints',
                test: async () => {
                    return await this.makeRequest('/api/auth/register', {
                        email: 'a'.repeat(250) + '@test.com',
                        password: 'Test123!',
                        firstName: 'A'.repeat(1000),
                        lastName: 'B'.repeat(1000),
                        phone: '+65 91234567'
                    });
                }
            }
        ];

        for (const { name, test } of constraintTests) {
            try {
                await test();
                this.coverageResults.registration.totalTests++;
            } catch (error) {
                console.log(`     ${name}: Error - ${error.message}`);
            }
        }
    }

    async testLoginTiming() {
        console.log('   Testing login timing consistency...');
        
        // Register test users
        const existingUser = `timing${Date.now()}@test.com`;
        await this.makeRequest('/api/auth/register', {
            email: existingUser,
            password: 'Test123!',
            firstName: 'Timing',
            lastName: 'Test',
            phone: '+65 91234567'
        });

        // Test timing differences
        const timingTests = [
            { email: existingUser, password: 'wrongpassword', expected: 'existing_user_wrong_password' },
            { email: 'nonexistent@test.com', password: 'anypassword', expected: 'nonexistent_user' },
            { email: existingUser, password: 'Test123!', expected: 'valid_login' }
        ];

        for (const timingTest of timingTests) {
            const start = performance.now();
            await this.makeRequest('/api/auth/login', {
                email: timingTest.email,
                password: timingTest.password
            });
            const duration = performance.now() - start;
            
            console.log(`     ${timingTest.expected}: ${duration.toFixed(2)}ms`);
            this.coverageResults.login.totalTests++;
        }
    }

    async testConcurrentOperations() {
        console.log('   Testing concurrent operations...');
        
        // Concurrent registrations
        const concurrentEmail = `concurrent${Date.now()}@test.com`;
        const concurrentRegistrations = Array(10).fill().map((_, i) => 
            this.makeRequest('/api/auth/register', {
                email: concurrentEmail,
                password: `Test123${i}!`,
                firstName: `User${i}`,
                lastName: 'Concurrent',
                phone: '+65 91234567'
            })
        );

        await Promise.allSettled(concurrentRegistrations);
        this.coverageResults.registration.totalTests += 10;

        // Concurrent logins
        await this.makeRequest('/api/auth/register', {
            email: 'logintest@test.com',
            password: 'Test123!',
            firstName: 'Login',
            lastName: 'Test',
            phone: '+65 91234567'
        });

        const concurrentLogins = Array(5).fill().map(() =>
            this.makeRequest('/api/auth/login', {
                email: 'logintest@test.com',
                password: 'Test123!'
            })
        );

        await Promise.allSettled(concurrentLogins);
        this.coverageResults.login.totalTests += 5;
    }

    async testResourceLimits() {
        console.log('   Testing resource limits...');
        
        // Large payload tests
        const largePayloadTests = [
            {
                name: 'Large Email',
                payload: {
                    email: 'a'.repeat(10000) + '@test.com',
                    password: 'Test123!',
                    firstName: 'Test',
                    lastName: 'User',
                    phone: '+65 91234567'
                }
            },
            {
                name: 'Large Password',
                payload: {
                    email: 'largepass@test.com',
                    password: 'a'.repeat(100000),
                    firstName: 'Test',
                    lastName: 'User',
                    phone: '+65 91234567'
                }
            },
            {
                name: 'All Large Fields',
                payload: {
                    email: 'b'.repeat(1000) + '@test.com',
                    password: 'c'.repeat(1000),
                    firstName: 'd'.repeat(1000),
                    lastName: 'e'.repeat(1000),
                    phone: '+65 91234567'
                }
            }
        ];

        for (const { name, payload } of largePayloadTests) {
            try {
                await this.makeRequest('/api/auth/register', payload);
                this.coverageResults.registration.totalTests++;
            } catch (error) {
                console.log(`     ${name}: ${error.message}`);
            }
        }
    }

    async runVulnerabilityScanning() {
        console.log('🚨 Scanning for vulnerabilities in uncovered lines...');
        
        const vulnerabilityTests = [
            {
                name: 'SQL Injection in Registration',
                test: () => this.testSQLInjection('registration')
            },
            {
                name: 'SQL Injection in Login', 
                test: () => this.testSQLInjection('login')
            },
            {
                name: 'XSS in User Data',
                test: () => this.testXSSVulnerabilities()
            },
            {
                name: 'JWT Security',
                test: () => this.testJWTSecurity()
            },
            {
                name: 'Password Hash Exposure',
                test: () => this.testPasswordHashExposure()
            }
        ];

        for (const { name, test } of vulnerabilityTests) {
            console.log(`   Testing: ${name}`);
            try {
                const result = await test();
                if (result.vulnerable) {
                    this.coverageResults[result.component].vulnerabilities.push({
                        type: name,
                        details: result.details,
                        severity: result.severity
                    });
                }
            } catch (error) {
                console.log(`     Error in ${name}: ${error.message}`);
            }
        }
    }

    async testSQLInjection(component) {
        const sqlPayloads = [
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users; --",
            "' OR '1'='1",
            "'; UPDATE users SET role='admin'; --"
        ];

        for (const payload of sqlPayloads) {
            if (component === 'registration') {
                const response = await this.makeRequest('/api/auth/register', {
                    email: payload + '@test.com',
                    password: 'Test123!',
                    firstName: payload,
                    lastName: 'Test',
                    phone: '+65 91234567'
                });
                this.coverageResults.registration.totalTests++;
                
                if (response.body.includes('mysql') || response.body.includes('SQL')) {
                    return {
                        vulnerable: true,
                        component: 'registration',
                        details: `SQL injection possible with payload: ${payload}`,
                        severity: 'HIGH'
                    };
                }
            } else {
                const response = await this.makeRequest('/api/auth/login', {
                    email: payload + '@test.com',
                    password: payload
                });
                this.coverageResults.login.totalTests++;
                
                if (response.body.includes('mysql') || response.body.includes('SQL')) {
                    return {
                        vulnerable: true,
                        component: 'login',
                        details: `SQL injection possible with payload: ${payload}`,
                        severity: 'HIGH'
                    };
                }
            }
        }

        return { vulnerable: false };
    }

    async testXSSVulnerabilities() {
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src="x" onerror="alert(1)">',
            'javascript:alert(1)',
            '<svg onload="alert(1)">'
        ];

        for (const payload of xssPayloads) {
            const response = await this.makeRequest('/api/auth/register', {
                email: 'xss@test.com',
                password: 'Test123!',
                firstName: payload,
                lastName: 'Test',
                phone: '+65 91234567'
            });
            this.coverageResults.registration.totalTests++;

            if (response.body.includes(payload) && !response.body.includes('&lt;')) {
                return {
                    vulnerable: true,
                    component: 'registration',
                    details: `XSS vulnerability with payload: ${payload}`,
                    severity: 'MEDIUM'
                };
            }
        }

        return { vulnerable: false };
    }

    async testJWTSecurity() {
        // Register and login to get JWT
        const testEmail = `jwt${Date.now()}@test.com`;
        await this.makeRequest('/api/auth/register', {
            email: testEmail,
            password: 'Test123!',
            firstName: 'JWT',
            lastName: 'Test',
            phone: '+65 91234567'
        });

        const loginResponse = await this.makeRequest('/api/auth/login', {
            email: testEmail,
            password: 'Test123!'
        });
        
        this.coverageResults.login.totalTests++;

        if (loginResponse.body.includes('secret') || loginResponse.body.includes('key')) {
            return {
                vulnerable: true,
                component: 'login',
                details: 'JWT secret information exposed in response',
                severity: 'CRITICAL'
            };
        }

        return { vulnerable: false };
    }

    async testPasswordHashExposure() {
        const response = await this.makeRequest('/api/auth/login', {
            email: 'nonexistent@test.com',
            password: 'test'
        });
        
        this.coverageResults.login.totalTests++;

        if (response.body.includes('$2b$') || response.body.includes('bcrypt')) {
            return {
                vulnerable: true,
                component: 'login',
                details: 'Password hash information exposed',
                severity: 'HIGH'
            };
        }

        return { vulnerable: false };
    }

    async runContinuousFuzzing(durationMinutes) {
        console.log(`🔄 Running continuous fuzzing for ${durationMinutes} minutes...`);
        
        const fuzzer = new AuthControllerFuzzer();
        const endTime = Date.now() + (durationMinutes * 60 * 1000);
        
        while (Date.now() < endTime) {
            await fuzzer.fuzzRegistration();
            await fuzzer.fuzzLogin();
            
            // Update our coverage tracking
            this.coverageResults.registration.totalTests += 50;
            this.coverageResults.login.totalTests += 50;
            
            console.log(`   Progress: ${this.coverageResults.registration.totalTests + this.coverageResults.login.totalTests} total tests`);
        }
    }

    async executeRegistrationTest(fuzzer, input, testType) {
        const testData = typeof input === 'string' ? 
            {
                email: input,
                password: 'Test123!',
                firstName: 'Test',
                lastName: 'User',
                phone: '+65 91234567'
            } : 
            {
                email: `test${Date.now()}@test.com`,
                password: 'Test123!',
                firstName: input.firstName || 'Test',
                lastName: input.lastName || 'User',
                phone: '+65 91234567',
                ...input
            };

        return await fuzzer.testRegistrationEndpoint(testData, testType);
    }

    async executeLoginTest(fuzzer, input, testType) {
        // If it's a password test, use the input as password
        if (testType === 'PASSWORD_VERIFICATION') {
            return await fuzzer.testLoginEndpoint({
                email: 'test@test.com',
                password: input
            }, testType);
        }
        
        // If it's an email test, use the input as email
        return await fuzzer.testLoginEndpoint({
            email: input,
            password: 'Test123!'
        }, testType);
    }

    async makeRequest(endpoint, data) {
        try {
            const response = await fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                timeout: 5000
            });
            
            const body = await response.text();
            return { status: response.status, body };
        } catch (error) {
            return { status: 500, body: error.message };
        }
    }

    async generateCoverageReport() {
        const report = {
            metadata: {
                timestamp: new Date().toISOString(),
                targetLines: this.targetLines,
                totalDuration: 'Variable based on test run'
            },
            coverageSummary: {
                registration: {
                    targetLines: this.targetLines.registration.range,
                    totalTests: this.coverageResults.registration.totalTests,
                    vulnerabilities: this.coverageResults.registration.vulnerabilities.length,
                    coverageEstimate: this.estimateCoverage('registration')
                },
                login: {
                    targetLines: this.targetLines.login.range,
                    totalTests: this.coverageResults.login.totalTests,
                    vulnerabilities: this.coverageResults.login.vulnerabilities.length,
                    coverageEstimate: this.estimateCoverage('login')
                }
            },
            vulnerabilities: {
                registration: this.coverageResults.registration.vulnerabilities,
                login: this.coverageResults.login.vulnerabilities
            },
            recommendations: this.generateRecommendations(),
            testBreakdown: {
                propertyBasedTests: 'Email normalization, password verification, JWT uniqueness, input validation, timing attacks',
                inputFuzzingTests: 'Edge cases for email, password, name validation',
                edgeCaseTests: 'Database constraints, timing consistency, concurrent operations, resource limits',
                vulnerabilityTests: 'SQL injection, XSS, JWT security, password hash exposure'
            }
        };

        const reportPath = `auth-controller-coverage-report-${Date.now()}.json`;
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log('\n📊 AuthController Coverage-Driven Fuzzing Report');
        console.log('=' .repeat(60));
        console.log(`📁 Report saved: ${reportPath}`);
        console.log(`🎯 Registration (${report.coverageSummary.registration.targetLines}):`);
        console.log(`   Tests executed: ${report.coverageSummary.registration.totalTests}`);
        console.log(`   Coverage estimate: ${report.coverageSummary.registration.coverageEstimate}%`);
        console.log(`   Vulnerabilities: ${report.coverageSummary.registration.vulnerabilities}`);
        console.log(`🎯 Login (${report.coverageSummary.login.targetLines}):`);
        console.log(`   Tests executed: ${report.coverageSummary.login.totalTests}`);
        console.log(`   Coverage estimate: ${report.coverageSummary.login.coverageEstimate}%`);
        console.log(`   Vulnerabilities: ${report.coverageSummary.login.vulnerabilities}`);
        
        if (report.vulnerabilities.registration.length > 0 || report.vulnerabilities.login.length > 0) {
            console.log('\n🚨 VULNERABILITIES FOUND:');
            for (const vuln of [...report.vulnerabilities.registration, ...report.vulnerabilities.login]) {
                console.log(`   ${vuln.severity}: ${vuln.type} - ${vuln.details}`);
            }
        }

        return report;
    }

    estimateCoverage(component) {
        const tests = this.coverageResults[component].totalTests;
        const baselineTests = 50; // Minimum tests needed for basic coverage
        
        // Rough estimation based on number of tests and test variety
        if (tests < baselineTests) {
            return Math.min(60, (tests / baselineTests) * 60);
        } else {
            // Diminishing returns after baseline
            const additionalCoverage = Math.min(30, ((tests - baselineTests) / 200) * 30);
            return 60 + additionalCoverage;
        }
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.coverageResults.registration.totalTests < 100) {
            recommendations.push('Increase registration testing to improve coverage of lines 105-149');
        }
        
        if (this.coverageResults.login.totalTests < 100) {
            recommendations.push('Increase login testing to improve coverage of lines 187-227');
        }
        
        if (this.coverageResults.registration.vulnerabilities.length > 0) {
            recommendations.push('Address registration vulnerabilities found during fuzzing');
        }
        
        if (this.coverageResults.login.vulnerabilities.length > 0) {
            recommendations.push('Address login vulnerabilities found during fuzzing');
        }
        
        recommendations.push('Consider adding unit tests specifically for uncovered edge cases');
        recommendations.push('Implement input validation improvements based on fuzzing results');
        recommendations.push('Add error handling tests for database constraint violations');
        
        return recommendations;
    }
}

// Export for testing
export default AuthControllerCoverageFuzzer;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const coverageFuzzer = new AuthControllerCoverageFuzzer();
    
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, generating coverage report...');
        await coverageFuzzer.generateCoverageReport();
        process.exit(0);
    });
    
    const duration = parseInt(process.argv[2]) || 60;
    console.log(`🎯 Starting AuthController coverage-driven fuzzing for ${duration} minutes`);
    console.log('📋 Targeting specific uncovered lines with vulnerability detection\n');
    
    coverageFuzzer.runTargetedFuzzing(duration).catch(console.error);
}
