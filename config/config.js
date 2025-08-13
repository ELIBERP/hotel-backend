import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

// for prod
dotenv.config({ path: '/etc/secrets/.env' });
if (!process.env.STRIPE_SECRET_KEY) dotenv.config();

// Get the directory of the current module
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Load .env from the project root (one level up from config/)
// dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default {
    JWTKey: process.env.REACT_JWT_KEY,
    JWTExpiry: process.env.REACT_JWT_EXPIRY,
    databaseHost: process.env.DB_HOST,
    databaseUsername: process.env.DB_USER,
    databasePassword: process.env.DB_PASS,
    databaseName: process.env.DB_NAME,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    clientUrl: process.env.CLIENT_URL,
};