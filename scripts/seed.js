import { pool } from '../config/database.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Test users data
const testUsers = [
    {
        email: 'john.doe@test.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+65 9123 4567'
    },
    {
        email: 'jane.smith@test.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+65 9876 5432'
    },
    {
        email: 'admin@hotel.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+65 6123 4567'
    },
    {
        email: 'guest@example.com',
        password: 'guest123',
        firstName: 'Guest',
        lastName: 'User',
        phone: null
    },
    {
        email: 'support@hotel.com',
        password: 'support123',
        firstName: 'Customer',
        lastName: 'Support',
        phone: '+65 6000 1234'
    }
];

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');
        
        // Check if users already exist
        const existingEmails = testUsers.map(user => user.email);
        const checkQuery = 'SELECT email FROM users WHERE email IN (?' + ',?'.repeat(existingEmails.length - 1) + ')';
        const [existingUsers] = await pool.execute(checkQuery, existingEmails);
        
        if (existingUsers.length > 0) {
            console.log('⚠️  Some test users already exist:');
            existingUsers.forEach(user => console.log(`   - ${user.email}`));
            
            // Ask if we should continue
            const readline = await import('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const answer = await new Promise(resolve => {
                rl.question('Do you want to delete existing test users and recreate them? (y/N): ', resolve);
            });
            rl.close();
            
            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                console.log('❌ Seeding cancelled by user');
                process.exit(0);
            }
            
            // Delete existing test users
            console.log('🗑️  Deleting existing test users...');
            const deleteQuery = 'DELETE FROM users WHERE email IN (?' + ',?'.repeat(existingEmails.length - 1) + ')';
            await pool.execute(deleteQuery, existingEmails);
            console.log('✅ Existing test users deleted');
        }
        
        // Insert test users
        console.log('👥 Creating test users...');
        
        for (const user of testUsers) {
            const userId = uuidv4();
            const passwordHash = await bcrypt.hash(user.password, 12);
            
            const insertQuery = `
                INSERT INTO users (id, email, password_hash, first_name, last_name, phone, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;
            
            await pool.execute(insertQuery, [
                userId,
                user.email,
                passwordHash,
                user.firstName,
                user.lastName,
                user.phone
            ]);
            
            console.log(`   ✅ Created: ${user.firstName} ${user.lastName} (${user.email})`);
        }
        
        // Display summary
        const [users] = await pool.execute(`
            SELECT 
                email,
                CONCAT(first_name, ' ', last_name) as full_name,
                phone,
                created_at
            FROM users 
            WHERE email IN (${existingEmails.map(() => '?').join(',')})
            ORDER BY created_at DESC
        `, existingEmails);
        
        console.log('\n📋 Test Users Summary:');
        console.log('┌─────────────────────────┬──────────────────┬─────────────────┐');
        console.log('│ Email                   │ Name             │ Phone           │');
        console.log('├─────────────────────────┼──────────────────┼─────────────────┤');
        
        users.forEach(user => {
            const email = user.email.padEnd(23);
            const name = user.full_name.padEnd(16);
            const phone = (user.phone || 'N/A').padEnd(15);
            console.log(`│ ${email} │ ${name} │ ${phone} │`);
        });
        
        console.log('└─────────────────────────┴──────────────────┴─────────────────┘');
        
        console.log('\n🔑 Default Passwords:');
        console.log('   - john.doe@test.com, jane.smith@test.com: password123');
        console.log('   - admin@hotel.com: admin123');
        console.log('   - guest@example.com: guest123');
        console.log('   - support@hotel.com: support123');
        
        console.log('\n🎉 Database seeding completed successfully!');
        
    } catch (error) {
        console.error('❌ Error seeding database:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedDatabase();
}

export default seedDatabase;
