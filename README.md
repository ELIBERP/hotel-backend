# 🏨 Hotel Booking API

![Node.js](https://img.shields.io/badge/Node.js-18.x-green)
![Express](https://img.shields.io/badge/Express-5.x-blue)
![MySQL](https://img.shields.io/badge/MySQL-8.x-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

A full-featured hotel booking backend API built with Node.js and Express. This service provides endpoints for hotel search, room booking, user authentication, and payment processing.

## ✨ Features

- **Hotel Search** - Search hotels by destination, dates, and guest count
- **Room Booking** - Book rooms with detailed information
- **User Authentication** - Secure JWT-based authentication
- **Payment Processing** - Integration with Stripe payment gateway
- **Destination Autocomplete** - Fast destination search with autocomplete
- **Caching** - Response caching for improved performance
- **Comprehensive Testing** - Unit and integration tests
- **Docker Support** - Easy containerization

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- MySQL 8.x (for booking persistence)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ELIBERP/hotel-backend.git
   cd hotel-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize the database**
   ```bash
   npm run db:init
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The server will be running at `http://localhost:3000`.

## 🔧 Configuration

Create a `.env` file in the project root with the following variables:

```
# API Configuration
PORT=3000
NODE_ENV=development

# Frontend URLs
FRONTEND_URL=http://localhost:5173
PRODUCTION_URL=https://your-production-frontend-url.com

# Hotel API (can be replaced with static data)
HOTELAPI=https://hotelapi.loyalty.dev

# Database Configuration
REACT_DB_HOST=localhost
REACT_DB_USERNAME=root
REACT_DB_PW=your_password
REACT_DB_NAME=hotel_booking

# JWT Authentication
REACT_JWT_KEY=your_jwt_secret_key_here
REACT_JWT_EXPIRY=24h

# Stripe Integration (Optional)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

## 🐳 Docker Support

This project includes Docker support for easy containerization:

```bash
# Build the Docker image
docker build -t hotel-booking-api .

# Run the container
docker run -p 3000:3000 -e HOTELAPI=https://hotelapi.loyalty.dev hotel-booking-api
```

## 📚 API Documentation

### Hotel Endpoints

- `GET /hotels` - Search hotels by destination
- `GET /hotels/prices` - Search hotels with pricing info
- `GET /hotels/:id` - Get hotel details
- `GET /hotels/:id/prices` - Get room prices for a specific hotel

### Booking Endpoints

- `POST /bookings` - Create a new booking
- `GET /bookings` - Get user's bookings
- `GET /bookings/:id` - Get booking details
- `POST /bookings/create-payment-session` - Create payment session

### Authentication Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - User login

### Destination Endpoints

- `GET /destinations/search?q=query` - Search destinations (autocomplete)
- `GET /destinations/:uid` - Get destination details

## 📁 Project Structure

```
hotel-backend/
├── config/              # Configuration files
│   ├── config.js        # Main configuration
│   ├── database.js      # Database connection
│   └── stripe.js        # Stripe integration
├── controller/          # Route handlers
│   ├── authController.js
│   ├── bookingController.js
│   ├── destinations.js
│   └── hotel.js
├── middleware/          # Express middleware
│   ├── auth.js          # Authentication middleware
│   └── cache.js         # Caching middleware
├── model/               # Data models
│   ├── booking.js
│   ├── destinations.js
│   ├── hotel.js
│   └── user.js
├── static/              # Static data (when not using API)
│   ├── hotels.json
│   ├── hotel_prices.json
│   └── hotel_rooms.json
├── tests/               # Test suites
│   ├── integration/
│   └── unit/
├── .dockerignore
├── .env.example
├── Dockerfile
├── errors.js            # Error handling
├── index.js             # Application entry point
└── package.json
```

## 🧪 Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run all tests with coverage
npm test
```

## 📝 Development

### Available Scripts

```bash
# Start in development mode
npm run dev

# Start in production mode
npm start

# Database operations
npm run db:test       # Test connection
npm run db:init       # Initialize schema
npm run db:reset      # Reset database
npm run db:seed       # Seed with test data
```

### Static Mode

This API can run without external API dependencies using static JSON files:

1. The model layer has been configured to fall back to static data in `/static/*.json`
2. This allows for development and testing without external dependencies
3. See model files for implementation details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- **ELIBERP** - *Initial work*

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [MySQL](https://www.mysql.com/) - Database
- [JWT](https://jwt.io/) - Authentication
- [Stripe](https://stripe.com/) - Payment processing

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
