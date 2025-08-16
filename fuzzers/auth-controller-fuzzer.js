#!/usr/bin/env node

/**
 * AuthController Targeted Fuzzer
 * Focuses on uncovered lines and authentication vulnerabilities
 * Lines to target: 105-149 (registration), 187-227 (login)
 */

import fc from 'fast-check';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import crypto from 'crypto';

class AuthControllerFuzzer {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.results = {
            registrationTests: [],
            loginTests: [],
            vulnerabilities: [],
            errors: [],
            coverageTargets: {
                registration: { lines: '105-149', tests: 0, vulnerabilities: 0 },
                login: { lines: '187-227', tests: 0, vulnerabilities: 0 }
            }
        };
        this.testCount = 0;
    }

    // Generate malicious and edge case inputs for authentication
    generateAuthPayloads() {
        return {
            // Email fuzzing - targeting normalization and validation
            maliciousEmails: [
                'admin@localhost',                              // Internal domain
                'test@192.168.1.1',                           // IP address
                'user+admin@test.com',                         // Plus addressing
                'test@test..com',                              // Double dot
                '"<script>alert(1)</script>"@test.com',       // XSS in email
                'admin"; DROP TABLE users; --@test.com',      // SQL injection
                'a'.repeat(255) + '@test.com',                // Oversized email
                'test@' + 'a'.repeat(255) + '.com',           // Long domain
                '../admin@evil.com',                          // Path traversal
                'test@test.com\x00admin@evil.com',           // Null byte injection
                'test@test.com\r\nadmin@evil.com',           // CRLF injection
                'admin@test.com%0D%0AContent-Type: text/html', // Header injection
            ],

            // Password fuzzing - targeting hash verification and storage
            maliciousPasswords: [
                '',                                           // Empty password
                ' ',                                         // Space only
                'a'.repeat(10000),                          // Extremely long
                'password\x00admin',                        // Null byte
                'password\r\nadmin',                        // CRLF
                '$2b$10$invalidhashformat',                 // Malformed bcrypt
                '${7*7}',                                   // Template injection
                '../../../etc/passwd',                     // Path traversal
                '<script>alert("XSS")</script>',           // XSS
                'admin\'; DROP TABLE users; --',           // SQL injection
                String.fromCharCode(0x00, 0x01, 0x02),     // Binary data
                'unicode测试🔒密码',                         // Unicode
                Array(1000).fill('a').join(''),            // Array-like input
            ],

            // Name fuzzing - targeting trim() and validation
            maliciousNames: [
                '',                                         // Empty
                ' '.repeat(100),                           // Spaces only  
                'John\x00Doe',                             // Null bytes
                'John\r\nDoe',                             // CRLF
                '<script>alert(1)</script>',               // XSS
                'John"; DROP TABLE users; --',            // SQL injection
                '../../admin',                             // Path traversal
                'A'.repeat(1000),                          // Oversized
                '${user.admin}',                          // Template injection
                'John\u0000Doe',                          // Unicode null
                'Normal Name<iframe src="evil.com">',     // HTML injection
            ],

            // Phone fuzzing
            maliciousPhones: [
                '+'.repeat(100),                          // Invalid format
                '+65 <script>alert(1)</script>',          // XSS
                '+65; DROP TABLE users; --',              // SQL injection
                '+65\x00+1234567890',                     // Null byte
                '1'.repeat(100),                          // Too long
                '+65 ${admin_phone}',                     // Template injection
            ]
        };
    }

    // Test registration endpoint (lines 105-149)
    async fuzzRegistration() {
        console.log('🎯 Fuzzing Registration (targeting lines 105-149)...');
        
        const payloads = this.generateAuthPayloads();
        
        // Test 1: Email normalization bypass
        console.log('Testing email normalization...');
        const emailTests = payloads.maliciousEmails.map(email => ({
            email,
            password: 'ValidPassword123!',
            firstName: 'Test',
            lastName: 'User',
            phone: '+65 91234567'
        }));

        for (const testData of emailTests) {
            await this.testRegistrationEndpoint(testData, 'EMAIL_NORMALIZATION');
        }

        // Test 2: Name trimming and validation
        console.log('Testing name validation...');
        for (const name of payloads.maliciousNames) {
            await this.testRegistrationEndpoint({
                email: `test${this.testCount}@test.com`,
                password: 'ValidPassword123!',
                firstName: name,
                lastName: 'User',
                phone: '+65 91234567'
            }, 'NAME_VALIDATION');
        }

        // Test 3: Password handling
        console.log('Testing password handling...');
        for (const password of payloads.maliciousPasswords) {
            await this.testRegistrationEndpoint({
                email: `test${this.testCount}@test.com`,
                password: password,
                firstName: 'Test',
                lastName: 'User',
                phone: '+65 91234567'
            }, 'PASSWORD_HANDLING');
        }

        // Test 4: Duplicate user creation race condition
        console.log('Testing duplicate user race condition...');
        await this.testRegistrationRaceCondition();

        // Test 5: Database error scenarios
        console.log('Testing database error scenarios...');
        await this.testRegistrationDatabaseErrors();
    }

    // Test login endpoint (lines 187-227)
    async fuzzLogin() {
        console.log('🎯 Fuzzing Login (targeting lines 187-227)...');
        
        const payloads = this.generateAuthPayloads();

        // Test 1: Email lookup bypass
        console.log('Testing email lookup...');
        for (const email of payloads.maliciousEmails) {
            await this.testLoginEndpoint({
                email: email,
                password: 'anypassword'
            }, 'EMAIL_LOOKUP');
        }

        // Test 2: Password verification bypass
        console.log('Testing password verification...');
        for (const password of payloads.maliciousPasswords) {
            await this.testLoginEndpoint({
                email: 'test@test.com',
                password: password
            }, 'PASSWORD_VERIFICATION');
        }

        // Test 3: JWT generation attacks
        console.log('Testing JWT generation...');
        await this.testJWTGeneration();

        // Test 4: Timing attacks
        console.log('Testing timing attacks...');
        await this.testTimingAttacks();

        // Test 5: Login error handling
        console.log('Testing login error scenarios...');
        await this.testLoginErrorScenarios();
    }

    async testRegistrationEndpoint(data, testType) {
        try {
            const startTime = performance.now();
            
            const response = await fetch(`${this.baseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                timeout: 5000
            });

            const endTime = performance.now();
            const responseTime = endTime - startTime;
            const responseText = await response.text();
            
            this.testCount++;
            this.results.coverageTargets.registration.tests++;

            const testResult = {
                type: testType,
                input: data,
                status: response.status,
                responseTime,
                response: responseText,
                timestamp: new Date().toISOString()
            };

            this.results.registrationTests.push(testResult);

            // Vulnerability detection
            await this.analyzeRegistrationResponse(response, responseText, data, testType);

        } catch (error) {
            this.results.errors.push({
                type: 'REGISTRATION_ERROR',
                testType,
                input: data,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }

        // Rate limiting
        await this.sleep(50);
    }

    async testLoginEndpoint(data, testType) {
        try {
            const startTime = performance.now();
            
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                timeout: 5000
            });

            const endTime = performance.now();
            const responseTime = endTime - startTime;
            const responseText = await response.text();
            
            this.testCount++;
            this.results.coverageTargets.login.tests++;

            const testResult = {
                type: testType,
                input: data,
                status: response.status,
                responseTime,
                response: responseText,
                timestamp: new Date().toISOString()
            };

            this.results.loginTests.push(testResult);

            // Vulnerability detection
            await this.analyzeLoginResponse(response, responseText, data, testType);

        } catch (error) {
            this.results.errors.push({
                type: 'LOGIN_ERROR',
                testType,
                input: data,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }

        // Rate limiting
        await this.sleep(50);
    }

    async analyzeRegistrationResponse(response, responseText, input, testType) {
        // Check for successful registration with malicious input
        if (response.status === 201) {
            const hasMaliciousInput = Object.values(input).some(value => 
                typeof value === 'string' && (
                    value.includes('<script>') ||
                    value.includes('DROP TABLE') ||
                    value.includes('../') ||
                    value.includes('\x00')
                )
            );

            if (hasMaliciousInput) {
                this.results.vulnerabilities.push({
                    severity: 'HIGH',
                    type: 'REGISTRATION_INPUT_BYPASS',
                    testType,
                    description: 'Malicious input accepted during registration',
                    input,
                    response: responseText,
                    lines: '105-149',
                    timestamp: new Date().toISOString()
                });
                this.results.coverageTargets.registration.vulnerabilities++;
            }
        }

        // Check for information disclosure
        if (responseText.includes('mysql') || 
            responseText.includes('sql') || 
            responseText.includes('database') ||
            responseText.includes('Error:')) {
            
            this.results.vulnerabilities.push({
                severity: 'MEDIUM',
                type: 'REGISTRATION_INFO_DISCLOSURE',
                testType,
                description: 'Database or internal error information disclosed',
                input,
                response: responseText,
                lines: '105-149',
                timestamp: new Date().toISOString()
            });
            this.results.coverageTargets.registration.vulnerabilities++;
        }

        // Check for user enumeration
        if (response.status === 409 && input.email.includes('admin')) {
            this.results.vulnerabilities.push({
                severity: 'LOW',
                type: 'USER_ENUMERATION',
                testType,
                description: 'User existence can be determined',
                input,
                response: responseText,
                lines: '105-149',
                timestamp: new Date().toISOString()
            });
        }
    }

    async analyzeLoginResponse(response, responseText, input, testType) {
        // Check for authentication bypass
        if (response.status === 200) {
            try {
                const jsonResponse = JSON.parse(responseText);
                if (jsonResponse.token && input.password.includes('<script>')) {
                    this.results.vulnerabilities.push({
                        severity: 'CRITICAL',
                        type: 'LOGIN_AUTH_BYPASS',
                        testType,
                        description: 'Authentication bypassed with malicious input',
                        input,
                        response: responseText,
                        lines: '187-227',
                        timestamp: new Date().toISOString()
                    });
                    this.results.coverageTargets.login.vulnerabilities++;
                }
            } catch (e) {
                // Response not JSON, continue analysis
            }
        }

        // Check for JWT secrets exposure
        if (responseText.includes('jwt') && 
           (responseText.includes('secret') || responseText.includes('key'))) {
            
            this.results.vulnerabilities.push({
                severity: 'CRITICAL',
                type: 'JWT_SECRET_DISCLOSURE',
                testType,
                description: 'JWT secret or key information disclosed',
                input,
                response: responseText,
                lines: '187-227',
                timestamp: new Date().toISOString()
            });
            this.results.coverageTargets.login.vulnerabilities++;
        }

        // Check for password hash disclosure
        if (responseText.includes('$2b$') || responseText.includes('bcrypt')) {
            this.results.vulnerabilities.push({
                severity: 'HIGH',
                type: 'PASSWORD_HASH_DISCLOSURE',
                testType,
                description: 'Password hash information disclosed',
                input,
                response: responseText,
                lines: '187-227',
                timestamp: new Date().toISOString()
            });
            this.results.coverageTargets.login.vulnerabilities++;
        }
    }

    async testRegistrationRaceCondition() {
        const email = `race${Date.now()}@test.com`;
        
        // Try to register the same user simultaneously
        const concurrentRegistrations = Array(5).fill().map(async (_, index) => {
            return this.testRegistrationEndpoint({
                email: email,
                password: 'Password123!',
                firstName: 'Race',
                lastName: `Test${index}`,
                phone: '+65 91234567'
            }, 'RACE_CONDITION');
        });

        await Promise.allSettled(concurrentRegistrations);
    }

    async testRegistrationDatabaseErrors() {
        // Test with extremely long inputs to trigger database errors
        await this.testRegistrationEndpoint({
            email: 'a'.repeat(1000) + '@test.com',
            password: 'Password123!',
            firstName: 'A'.repeat(1000),
            lastName: 'B'.repeat(1000),
            phone: '+65 91234567'
        }, 'DATABASE_ERROR');
    }

    async testJWTGeneration() {
        // First register a user
        const testEmail = `jwt${Date.now()}@test.com`;
        
        await fetch(`${this.baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: 'Password123!',
                firstName: 'JWT',
                lastName: 'Test',
                phone: '+65 91234567'
            })
        });

        // Then test login to trigger JWT generation
        await this.testLoginEndpoint({
            email: testEmail,
            password: 'Password123!'
        }, 'JWT_GENERATION');
    }

    async testTimingAttacks() {
        const validEmail = 'timing@test.com';
        const invalidEmail = 'nonexistent@test.com';
        
        // Register a user first
        await fetch(`${this.baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: validEmail,
                password: 'Password123!',
                firstName: 'Timing',
                lastName: 'Test',
                phone: '+65 91234567'
            })
        });

        // Test timing differences
        const tests = [
            { email: validEmail, password: 'wrongpassword' },
            { email: invalidEmail, password: 'anypassword' }
        ];

        for (const test of tests) {
            await this.testLoginEndpoint(test, 'TIMING_ATTACK');
        }
    }

    async testLoginErrorScenarios() {
        // Test various error conditions
        const errorTests = [
            { email: null, password: 'test' },
            { email: 'test@test.com', password: null },
            { email: undefined, password: undefined },
            { email: {}, password: [] },
            { email: 'test@test.com' }, // Missing password
            { password: 'test' }, // Missing email
        ];

        for (const test of errorTests) {
            await this.testLoginEndpoint(test, 'ERROR_HANDLING');
        }
    }

    async generateReport() {
        const report = {
            summary: {
                totalTests: this.testCount,
                registrationTests: this.results.registrationTests.length,
                loginTests: this.results.loginTests.length,
                vulnerabilities: this.results.vulnerabilities.length,
                errors: this.results.errors.length,
                coverageTargets: this.results.coverageTargets
            },
            vulnerabilityBreakdown: {
                critical: this.results.vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
                high: this.results.vulnerabilities.filter(v => v.severity === 'HIGH').length,
                medium: this.results.vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
                low: this.results.vulnerabilities.filter(v => v.severity === 'LOW').length
            },
            vulnerabilities: this.results.vulnerabilities,
            coverageAnalysis: {
                registration: {
                    targetLines: '105-149',
                    testsExecuted: this.results.coverageTargets.registration.tests,
                    vulnerabilitiesFound: this.results.coverageTargets.registration.vulnerabilities,
                    mainTargets: [
                        'Email normalization (line 107)',
                        'User existence check (lines 110-118)',
                        'User creation (lines 120-138)',
                        'Response formatting (lines 140-149)'
                    ]
                },
                login: {
                    targetLines: '187-227',
                    testsExecuted: this.results.coverageTargets.login.tests,
                    vulnerabilitiesFound: this.results.coverageTargets.login.vulnerabilities,
                    mainTargets: [
                        'User lookup (lines 187-192)',
                        'Password verification (lines 194-201)',
                        'JWT generation (lines 203-213)',
                        'Response with token (lines 215-227)'
                    ]
                }
            },
            errors: this.results.errors,
            timestamp: new Date().toISOString()
        };

        const reportPath = `auth-controller-fuzzing-report-${Date.now()}.json`;
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\n📊 AuthController Fuzzing Report Generated: ${reportPath}`);
        console.log(`🎯 Coverage Targets:`);
        console.log(`   Registration (105-149): ${report.coverageAnalysis.registration.testsExecuted} tests, ${report.coverageAnalysis.registration.vulnerabilitiesFound} vulnerabilities`);
        console.log(`   Login (187-227): ${report.coverageAnalysis.login.testsExecuted} tests, ${report.coverageAnalysis.login.vulnerabilitiesFound} vulnerabilities`);
        console.log(`🚨 Total Vulnerabilities: ${report.summary.vulnerabilities}`);
        console.log(`   Critical: ${report.vulnerabilityBreakdown.critical}`);
        console.log(`   High: ${report.vulnerabilityBreakdown.high}`);
        console.log(`   Medium: ${report.vulnerabilityBreakdown.medium}`);
        console.log(`   Low: ${report.vulnerabilityBreakdown.low}`);

        return report;
    }

    async runContinuousFuzzing(durationMinutes = 60) {
        console.log(`🚀 Starting AuthController Continuous Fuzzing for ${durationMinutes} minutes...`);
        console.log('🎯 Targeting uncovered lines: 105-149 (registration), 187-227 (login)');
        
        const startTime = Date.now();
        const endTime = startTime + (durationMinutes * 60 * 1000);
        
        while (Date.now() < endTime) {
            console.log(`\n⏱️  ${Math.floor((Date.now() - startTime) / 60000)} minutes elapsed...`);
            
            await this.fuzzRegistration();
            await this.fuzzLogin();
            
            // Progress report
            console.log(`📊 Progress: ${this.testCount} tests, ${this.results.vulnerabilities.length} vulnerabilities found`);
            
            // Small delay between cycles
            await this.sleep(1000);
        }
        
        console.log('✅ Continuous fuzzing completed');
        return await this.generateReport();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for testing
export default AuthControllerFuzzer;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const fuzzer = new AuthControllerFuzzer();
    
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, generating report...');
        await fuzzer.generateReport();
        process.exit(0);
    });
    
    // Run for 1 hour by default, or specify duration in minutes
    const duration = parseInt(process.argv[2]) || 60;
    console.log(`🎯 Starting AuthController fuzzing for ${duration} minutes`);
    
    fuzzer.runContinuousFuzzing(duration).catch(console.error);
}
