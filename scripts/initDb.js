#!/usr/bin/env node

// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

import { testConnection } from '../config/database.js';
import { createTables, dropTables } from './setupDatabase.js';
import { pool } from '../config/database.js';

async function initDatabase() {
    try {
        console.log('Initializing Hotel Booking Database...\n');
        
        // Test connection first
        const connected = await testConnection();
        if (!connected) {
            console.error('Cannot proceed without database connection');
            process.exit(1);
        }
        
        // Get command line arguments
        const args = process.argv.slice(2);
        const shouldReset = args.includes('--reset');
        
        if (shouldReset) {
            console.log('RESET MODE: Dropping existing tables...');
            await dropTables();
            console.log('');
        }
        
        // Create tables
        await createTables();
        
        
    } catch (error) {
        process.exit(1);
    } finally {
        // Close the connection pool
        await pool.end();
    }
}

// Run the initialization
initDatabase();
