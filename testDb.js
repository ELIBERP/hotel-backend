import { testConnection, pool } from './config/database.js';

async function quickTest() {
    console.log('Testing database connection...');
    const connected = await testConnection();
    
    if (connected) {
        console.log('Database is working!');
    } else {
        console.log('Database connection failed');
        console.log('Check your .env file and MySQL server');
    }
    
    // Close the connection pool to exit cleanly
    await pool.end();
    process.exit(0);
}

quickTest();
