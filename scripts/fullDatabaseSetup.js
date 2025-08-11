#!/usr/bin/env node

console.log(`
🏨 HOTEL BOOKING SYSTEM - DATABASE INITIALIZATION GUIDE
======================================================

📋 PREREQUISITES
-----------------
1. ✅ MySQL Server installed and running
2. ✅ Database credentials configured in .env file
3. ✅ Node.js dependencies installed (npm install)

🔧 ENVIRONMENT SETUP
--------------------
Ensure your .env file contains:
REACT_DB_HOST=localhost
REACT_DB_USERNAME=your_username
REACT_DB_PW=your_password
REACT_DB_NAME=hotel_booking_db

🚀 DATABASE INITIALIZATION STEPS
=================================

STEP 1: Create Database (Manual - Do this first!)
--------------------------------------------------
mysql -u your_username -p
CREATE DATABASE hotel_booking_db;
USE hotel_booking_db;
EXIT;

STEP 2: Initialize Tables (Automated)
-------------------------------------
cd hotel-backend
npm run db:init

This will create:
- users table (authentication)
- bookings table (reservations)
- payment_sessions table (payment tracking)

STEP 3: Seed Test Data (Optional)
---------------------------------
npm run db:seed

This will create test users:
- test@hotel.com / password123
- admin@hotel.com / admin123
- john.doe@test.com / password123
- jane.smith@test.com / password123
- guest@example.com / guest123

STEP 4: Test Database Connection
-------------------------------
npm run db:test

⚡ QUICK START COMMANDS
======================
# Fresh database setup
npm run db:reset    # Drop and recreate all tables
npm run db:seed     # Add test data

# Check if everything works
npm run db:test     # Test connection
npm start           # Start the server

🔍 TROUBLESHOOTING
==================
If you get connection errors:
1. Check MySQL is running: sudo service mysql start
2. Verify credentials in .env file
3. Ensure database exists: mysql -u root -p -e "SHOW DATABASES;"
4. Check firewall/port 3306 access

If tables aren't created:
1. Check MySQL user permissions
2. Run: npm run db:reset (this will recreate everything)
3. Check logs for specific error messages

💡 ADVANCED OPTIONS
===================
# Reset database (WARNING: Deletes all data!)
npm run db:reset

# Use SQL file directly
mysql -u username -p database_name < database/schema.sql

# Manual seed with SQL
npm run db:seed:sql

📊 DATABASE SCHEMA
==================
The system creates these main tables:

users:
- id, email, password_hash, first_name, last_name
- phone, role, email_verified, is_active
- created_at, updated_at

bookings:
- id, hotel_id, hotel_name, start_date, end_date
- nights, adults, children, total_price, currency
- first_name, last_name, email, phone
- billing_address (JSON), booking_status
- created_at, updated_at

payment_sessions:
- id, booking_id, user_id, session_data (JSON)
- status, expires_at, created_at

🎯 FOR YOUR PAYMENT GATEWAY TESTING
===================================
After database initialization, your tests will work with:
1. ✅ Real database tables for booking model tests
2. ✅ Test users for authentication tests  
3. ✅ Payment session tracking for Stripe integration
4. ✅ Complete booking workflow from form to payment

Run your tests after initialization:
npm run test:payment
`);

const readline = await import('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const answer = await new Promise(resolve => {
    rl.question('\n🚀 Ready to initialize database? (y/N): ', resolve);
});
rl.close();

if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log('\n🔧 Starting database initialization...\n');
    
    // Import and run initialization
    const { execSync } = await import('child_process');
    
    try {
        // Step 1: Initialize tables
        console.log('Step 1: Creating database tables...');
        execSync('npm run db:init', { stdio: 'inherit' });
        
        // Step 2: Ask about seeding
        const rl2 = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const seedAnswer = await new Promise(resolve => {
            rl2.question('\n🌱 Add test users and data? (y/N): ', resolve);
        });
        rl2.close();
        
        if (seedAnswer.toLowerCase() === 'y' || seedAnswer.toLowerCase() === 'yes') {
            console.log('\nStep 2: Seeding test data...');
            execSync('npm run db:seed', { stdio: 'inherit' });
        }
        
        // Step 3: Test connection
        console.log('\nStep 3: Testing database connection...');
        execSync('npm run db:test', { stdio: 'inherit' });
        
        console.log('\n🎉 Database initialization complete!');
        console.log('You can now run: npm start');
        
    } catch (error) {
        console.error('\n❌ Error during initialization:', error.message);
        console.log('\nPlease check the troubleshooting section above.');
    }
} else {
    console.log('\n📖 Database initialization cancelled. Use the guide above when ready.');
}
