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

### 3. Create a `.env` File
Create a `.env` file in the root of the `hotel-backend` directory with the following content:

```
HOTELAPI=INSERT_GIVEN_URL
FRONTEND_URL=http://localhost:5173
PRODUCTION_URL=https://your-production-frontend-url.com
```
- `HOTELAPI`: The base URL for the hotel API (default provided).
- `FRONTEND_URL`: The URL of your frontend development server (default: localhost:5173).
- `PRODUCTION_URL`: The URL of your deployed frontend (if any).

### 4. Run the Server
```sh
npm start
```
The server will run on `http://localhost:3000` by default.

## Project Structure

- `controller/` — Route handlers and controllers (e.g., `hotel.js`).
- `model/` — Data access and business logic (e.g., `hotel.js`).
- `middleware/` — Express middleware (e.g., `auth.js`).
- `config/` — Configuration files (e.g., `config.js`).
- `routes/` — (Optional) Additional route definitions.
- `errors.js` — Custom error classes and error codes.
- `index.js` — Main entry point for the Express app.

### Adding New Files
- **Controllers**: Add new route logic in the `controller/` folder. Export a router from each controller file.
- **Models**: Add new data access or business logic in the `model/` folder. (Think, this is the direct connection to your database)
- **Middleware**: Add reusable middleware in the `middleware/` folder.
- **Routes**: If you want to organize routes separately, use the `routes/` folder and import them in `index.js`.
- **Config**: Store configuration and environment-specific settings in `config/`.

> **Tip:** Keep controllers focused on handling requests/responses, and models focused on data/business logic. This keeps the codebase modular and maintainable.

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
