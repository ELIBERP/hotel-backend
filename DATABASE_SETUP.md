# Database Setup Guide

Environment Configuration
Create a `.env` file in the root directory with your database credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=hotel_app_user
DB_PASSWORD=your_secure_password
DB_NAME=hotel_booking_db

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=24h

# Server Configuration
PORT=3000
```

### 3. Database Setup

**Option A: Automatic Setup (Recommended)**
```bash
# Test database connection
npm run db:test

# Initialize database tables
npm run db:init

# Reset database (drops and recreates all tables)
npm run db:reset
```

### 2. Tables

The database consists of three main tables:

- **users**: User accounts and authentication
- **bookings**: Hotel booking records
- **payment_sessions**: Payment processing tracking

Tables are automatically created when you run `npm run db:init`.

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Bookings Table
```sql
CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    hotel_id VARCHAR(100) NOT NULL,
    hotel_name VARCHAR(255) NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    room_type VARCHAR(100) NOT NULL,
    num_guests INT NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status ENUM('pending', 'confirmed', 'cancelled') DEFAULT 'pending',
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    special_requests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Payment Sessions Table
```sql
CREATE TABLE payment_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
```

## Available NPM Scripts

```bash
# Database Management
npm run db:test      # Test database connection
npm run db:init      # Initialize/create all tables
npm run db:reset     # Drop and recreate all tables

# Development
npm run dev          # Start server in development mode
npm start           # Start server in production mode

# Testing
npm run test:unit        # Run unit tests
npm run test:integration # Run integration tests
```

## Troubleshooting

### Connection Issues

1. **Access Denied Error**
   ```
   Error: Access denied for user 'hotel_app_user'@'localhost'
   ```
   - Verify MySQL credentials in `.env` file
   - Ensure user exists and has proper permissions
   - Check if MySQL server is running

2. **Database Not Found**
   ```
   Error: Unknown database 'hotel_booking_db'
   ```
   - Create the database manually: `CREATE DATABASE hotel_booking_db;`
   - Run `npm run db:init` to create tables

3. **Connection Timeout**
   ```
   Error: connect ETIMEDOUT
   ```
   - Check if MySQL server is running
   - Verify host and port in `.env` file
   - Check firewall settings

### Common Setup Issues

1. **Missing Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   - Ensure `.env` file exists and contains all required variables
   - Check for typos in variable names

3. **Permissions**
   - Ensure the database user has sufficient privileges
   - Grant additional permissions if needed:
     ```sql
     GRANT ALL PRIVILEGES ON hotel_booking_db.* TO 'hotel_app_user'@'localhost';
     ```

## Security Notes

- **Never commit `.env` files** to version control
- Use strong passwords for database users
- Regularly update dependencies for security patches
- Consider using connection pooling for production environments

## Development Workflow

1. Pull latest code from repository
2. Run `npm install` to install dependencies
3. Copy `.env.example` to `.env` and configure
4. Run `npm run db:test` to verify connection
5. Run `npm run db:init` to set up tables
6. Start development with `npm run dev`

## Production Deployment

For production environments:

1. Use environment-specific database credentials
2. Enable SSL connections for database
3. Set up proper backup strategies
4. Monitor connection pool usage
5. Use connection encryption

---

