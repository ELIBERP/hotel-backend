# ESC Hotel Backend

This is the backend API for the ESC Hotel project, built with Node.js and Express. It provides endpoints for hotel data and authentication, and is designed to work with a frontend (e.g., React) running on a different port (default: 5173).

## Setup Instructions

### 1. Clone the Repository
```sh
git clone https://github.com/ELIBERP/hotel-backend.git
cd esc-hotel/hotel-backend
```

### 2. Install Dependencies
```sh
npm install
```

### 3. Database Setup
This application requires MySQL for data persistence. 

**Quick Setup:**
```sh
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
# Then initialize the database
npm run db:test    # Test connection
npm run db:init    # Create tables
```

For detailed database setup instructions, see [DATABASE_SETUP.md](./DATABASE_SETUP.md).

### 4. Create a `.env` File
Create a `.env` file in the root of the `hotel-backend` directory with the following content:

```
# Hotel API
HOTELAPI=INSERT_GIVEN_URL
FRONTEND_URL=http://localhost:5173
PRODUCTION_URL=https://your-production-frontend-url.com

# Database (required for booking system)
DB_HOST=localhost
DB_PORT=3306
DB_USER=hotel_app_user
DB_PASSWORD=your_secure_password
DB_NAME=hotel_booking_db

# JWT Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=24h
```
- `HOTELAPI`: The base URL for the hotel API (default provided).
- `FRONTEND_URL`: The URL of your frontend development server (default: localhost:5173).
- `PRODUCTION_URL`: The URL of your deployed frontend (if any).
- `DB_*`: Database connection credentials (see DATABASE_SETUP.md for details).
- `JWT_*`: JSON Web Token configuration for authentication.

### 5. Run the Server
```sh
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```
The server will run on `http://localhost:3000` by default.

## Available Scripts

```sh
# Server Commands
npm start              # Start server in production mode
npm run dev           # Start server in development mode (with nodemon)

# Database Commands
npm run db:test       # Test database connection
npm run db:init       # Initialize database tables
npm run db:reset      # Reset database (drop and recreate tables)

# Testing Commands
npm run test:unit         # Run unit tests
npm run test:integration  # Run integration tests
```

## Project Structure

- `controller/` — Route handlers and controllers (e.g., `hotel.js`).
- `model/` — Data access and business logic (e.g., `hotel.js`).
- `middleware/` — Express middleware (e.g., `auth.js`).
- `config/` — Configuration files (e.g., `config.js`, `database.js`).
- `scripts/` — Database setup and management scripts.
- `tests/` — Unit and integration tests.
- `errors.js` — Custom error classes and error codes.
- `index.js` — Main entry point for the Express app.
- `DATABASE_SETUP.md` — Detailed database setup instructions.
- `.env.example` — Template for environment variables.

### Adding New Files
- **Controllers**: Add new route logic in the `controller/` folder. Export a router from each controller file.
- **Models**: Add new data access or business logic in the `model/` folder. (Think, this is the direct connection to your database)
- **Middleware**: Add reusable middleware in the `middleware/` folder.
- **Routes**: If you want to organize routes separately, use the `routes/` folder and import them in `index.js`.
- **Config**: Store configuration and environment-specific settings in `config/`.

> **Tip:** Keep controllers focused on handling requests/responses, and models focused on data/business logic. This keeps the codebase modular and maintainable.

## Adding new test cases
- Use **/tests/unit** to test the business logic of the APIs. Mock the response of the API
- Use **/tests/integration** to test the actual working of the APIs

## Example Requests

You can use tools like [Postman](https://www.postman.com/) or [curl](https://curl.se/) to test the backend.

### 1. Test the Welcome Route
```
GET http://localhost:3000/
```
**Response:**
```
Welcome to the Hotel API!
```

## Notes
- Ensure your `.env` file is not committed to version control.
- Update `FRONTEND_URL` and `PRODUCTION_URL` as needed for your deployment.
- For new features, follow the folder structure and keep code modular.

---

For any questions, contact the project maintainer or check the code comments for guidance.
