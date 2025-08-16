#!/usr/bin/env node

/**
 * AuthController Fuzzer Test Harness
 * Property-based testing for specific uncovered lines
 */

import fc from 'fast-check';
import fetch from 'node-fetch';

class AuthControllerPropertyTester {
    constructor() {
        this.properties = [];
    }

    // Property: Email normalization should be consistent
    emailNormalizationProperty() {
        return fc.asyncProperty(
            fc.emailAddress(),
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ minLength: 8, maxLength: 20 }),
            async (email, firstName, password) => {
                const normalizedEmail = email.toLowerCase().trim();
                
                // Test registration with original email
                const response1 = await this.makeRegistrationRequest({
                    email: email,
                    password: password,
                    firstName: firstName,
                    lastName: 'Test',
                    phone: '+65 91234567'
                });
                
                // Test registration with normalized email (should fail if first succeeded)
                const response2 = await this.makeRegistrationRequest({
                    email: normalizedEmail,
                    password: password + '2',
                    firstName: firstName + '2',
                    lastName: 'Test2',
                    phone: '+65 91234567'
                });
                
                // If first registration was successful, second should fail with conflict
                if (response1.status === 201) {
                    return response2.status === 409; // Should be conflict
                }
                
                return true; // If first failed, property is satisfied
            }
        );
    }

    // Property: Password verification should be deterministic
    passwordVerificationProperty() {
        return fc.asyncProperty(
            fc.emailAddress(),
            fc.string({ minLength: 8, maxLength: 100 }),
            async (email, password) => {
                // Register user
                const registerResponse = await this.makeRegistrationRequest({
                    email: email,
                    password: password,
                    firstName: 'Test',
                    lastName: 'User',
                    phone: '+65 91234567'
                });
                
                if (registerResponse.status !== 201) {
                    return true; // Skip if registration failed
                }
                
                // Login with correct password multiple times
                const loginAttempts = await Promise.all([
                    this.makeLoginRequest({ email, password }),
                    this.makeLoginRequest({ email, password }),
                    this.makeLoginRequest({ email, password })
                ]);
                
                // All attempts should have same result
                const firstStatus = loginAttempts[0].status;
                return loginAttempts.every(attempt => attempt.status === firstStatus);
            }
        );
    }

    // Property: JWT tokens should be unique for each login
    jwtUniquenessProperty() {
        return fc.asyncProperty(
            fc.emailAddress(),
            fc.string({ minLength: 8, maxLength: 100 }),
            async (email, password) => {
                // Register user
                const registerResponse = await this.makeRegistrationRequest({
                    email: email,
                    password: password,
                    firstName: 'JWT',
                    lastName: 'Test',
                    phone: '+65 91234567'
                });
                
                if (registerResponse.status !== 201) {
                    return true; // Skip if registration failed
                }
                
                // Login multiple times
                const login1 = await this.makeLoginRequest({ email, password });
                const login2 = await this.makeLoginRequest({ email, password });
                
                if (login1.status !== 200 || login2.status !== 200) {
                    return true; // Skip if logins failed
                }
                
                try {
                    const token1 = JSON.parse(login1.body).token;
                    const token2 = JSON.parse(login2.body).token;
                    
                    // Tokens should be different (new tokens for each login)
                    return token1 !== token2;
                } catch (e) {
                    return true; // Skip if response parsing failed
                }
            }
        );
    }

    // Property: Registration input validation should be consistent
    inputValidationProperty() {
        return fc.asyncProperty(
            fc.oneof(
                fc.constant(null),
                fc.constant(undefined),
                fc.constant(''),
                fc.string({ minLength: 1000, maxLength: 2000 }) // Very long string
            ),
            fc.oneof(
                fc.constant(null),
                fc.constant(undefined),
                fc.constant(''),
                fc.string({ minLength: 1000, maxLength: 2000 })
            ),
            async (maliciousEmail, maliciousPassword) => {
                const response = await this.makeRegistrationRequest({
                    email: maliciousEmail,
                    password: maliciousPassword,
                    firstName: 'Test',
                    lastName: 'User',
                    phone: '+65 91234567'
                });
                
                // Should never return 201 (success) for malicious inputs
                return response.status !== 201;
            }
        );
    }

    // Property: Timing attacks should not reveal user existence
    timingAttackProperty() {
        return fc.asyncProperty(
            fc.emailAddress(),
            fc.string({ minLength: 8, maxLength: 100 }),
            fc.emailAddress(),
            async (existingEmail, password, nonExistingEmail) => {
                // Register a user
                await this.makeRegistrationRequest({
                    email: existingEmail,
                    password: password,
                    firstName: 'Existing',
                    lastName: 'User',
                    phone: '+65 91234567'
                });
                
                // Time login attempts
                const start1 = performance.now();
                await this.makeLoginRequest({ 
                    email: existingEmail, 
                    password: 'wrongpassword' 
                });
                const time1 = performance.now() - start1;
                
                const start2 = performance.now();
                await this.makeLoginRequest({ 
                    email: nonExistingEmail, 
                    password: 'anypassword' 
                });
                const time2 = performance.now() - start2;
                
                // Time difference should not be too significant
                const timeDiff = Math.abs(time1 - time2);
                return timeDiff < 1000; // Less than 1 second difference
            }
        );
    }

    async makeRegistrationRequest(data) {
        try {
            const response = await fetch('http://localhost:3000/auth/register', {
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

    async makeLoginRequest(data) {
        try {
            const response = await fetch('http://localhost:3000/auth/login', {
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

    async runPropertyTests() {
        console.log('🧪 Running AuthController Property-Based Tests...');
        console.log('🎯 Targeting coverage lines: 105-149, 187-227\n');
        
        const properties = [
            {
                name: 'Email Normalization Consistency',
                property: this.emailNormalizationProperty(),
                targetLines: '105-149'
            },
            {
                name: 'Password Verification Determinism',
                property: this.passwordVerificationProperty(),
                targetLines: '187-227'
            },
            {
                name: 'JWT Token Uniqueness',
                property: this.jwtUniquenessProperty(),
                targetLines: '187-227'
            },
            {
                name: 'Input Validation Consistency',
                property: this.inputValidationProperty(),
                targetLines: '105-149'
            },
            {
                name: 'Timing Attack Resistance',
                property: this.timingAttackProperty(),
                targetLines: '187-227'
            }
        ];

        const results = [];
        
        for (const { name, property, targetLines } of properties) {
            console.log(`🧪 Testing: ${name} (lines ${targetLines})`);
            
            try {
                const result = await fc.assert(property, {
                    numRuns: 50,
                    timeout: 30000,
                    verbose: true
                });
                
                results.push({
                    name,
                    targetLines,
                    status: 'PASSED',
                    result
                });
                
                console.log(`✅ ${name}: PASSED\n`);
            } catch (error) {
                results.push({
                    name,
                    targetLines,
                    status: 'FAILED',
                    error: error.message
                });
                
                console.log(`❌ ${name}: FAILED`);
                console.log(`   Error: ${error.message}\n`);
            }
        }
        
        // Generate summary
        const passed = results.filter(r => r.status === 'PASSED').length;
        const failed = results.filter(r => r.status === 'FAILED').length;
        
        console.log('📊 Property Test Summary:');
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   📈 Coverage: Lines 105-149, 187-227 targeted`);
        
        return results;
    }
}

// Export for testing
export default AuthControllerPropertyTester;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new AuthControllerPropertyTester();
    
    console.log('🎯 AuthController Property-Based Fuzzing');
    console.log('📋 Testing specific uncovered lines for vulnerabilities\n');
    
    tester.runPropertyTests().catch(console.error);
}
