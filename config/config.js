import dotenv from "dotenv";
dotenv.config();

export default {
    JWTKey: process.env.REACT_JWT_KEY,
    JWTExpiry: process.env.REACT_JWT_EXPIRY,
    databaseHost: process.env.REACT_DB_HOST,
    databaseUsername: process.env.REACT_DB_USERNAME,
    databasePassword: process.env.REACT_DB_PW,
    databaseName: process.env.REACT_DB_NAME,
};