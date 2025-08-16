#!/usr/bin/env node

/**
 * Simple Auth Fuzzer Test
 */

import fetch from 'node-fetch';

async function quickTest() {
    console.log('🚀 Starting Quick Auth Fuzzer Test...');
    
    const maliciousInputs = [
        { email: 'test1@test.com', password: 'Test123!' },
        { email: 'admin"; DROP TABLE users; --@test.com', password: 'Test123!' },
        { email: '<script>alert(1)</script>@test.com', password: 'Test123!' },
        { email: 'test2@test.com', password: 'a'.repeat(1000) },
    ];
    
    let testCount = 0;
    let vulnerabilities = 0;
    
    for (const input of maliciousInputs) {
        try {
            console.log(`Testing: ${input.email.substring(0, 30)}...`);
            
            const response = await fetch('http://localhost:3000/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: input.email,
                    password: input.password,
                    firstName: 'Test',
                    lastName: 'User',
                    phone: '+65 91234567'
                }),
                timeout: 5000
            });
            
            const responseText = await response.text();
            testCount++;
            
            console.log(`  Status: ${response.status}`);
            
            // Check for vulnerabilities
            if (response.status === 201 && (input.email.includes('<script>') || input.email.includes('DROP TABLE'))) {
                console.log(`  ⚠️ VULNERABILITY: Malicious input accepted!`);
                vulnerabilities++;
            }
            
            if (responseText.includes('mysql') || responseText.includes('Error:')) {
                console.log(`  ⚠️ INFO DISCLOSURE: Database error exposed!`);
                vulnerabilities++;
            }
            
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 Results:`);
    console.log(`  Tests completed: ${testCount}`);
    console.log(`  Vulnerabilities found: ${vulnerabilities}`);
    console.log(`  ✅ Auth fuzzer is working!`);
}

quickTest().catch(console.error);
