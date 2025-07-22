import mysql from 'mysql2/promise';
import config from './config.js';

// Create connection pool for better performance
const pool = mysql.createPool({
    host: config.databaseHost,
    user: config.databaseUsername,
    password: config.databasePassword,
    database: config.databaseName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        return false;
    }
}

export { pool, testConnection };
