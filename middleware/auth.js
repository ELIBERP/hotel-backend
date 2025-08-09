import jwt from "jsonwebtoken";
import config from "../config/config.js";

const verifyToken = (req, res, next) => {
    // Extract the token
    const authHeader = req.headers["authorization"];
    console.log('Auth header:', authHeader);
    
    const token = authHeader && authHeader.split(" ")[1];
    console.log('Extracted token:', token ? `${token.substring(0, 20)}...` : 'null');

    // Check for missing, undefined, or "null" string token
    if (!token || token === 'null' || token === 'undefined') {
        console.log('❌ No valid token provided (token is:', token, ')');
        return res.status(401).json({
            success: false,
            message: 'No authentication token provided',
            error: 'MISSING_TOKEN'
        });
    }

    console.log('JWT secret key (first 10 chars):', config.JWTKey ? config.JWTKey.substring(0, 10) + '...' : 'undefined');

    // Proceed to verify localStorage's token against secret key
    jwt.verify(token, config.JWTKey, (err, decoded) => {
        // If error, incorrect secret key used
        if (err) {
            console.error('❌ JWT verification failed:', err.message);
            console.error('❌ Error name:', err.name);
            console.error('❌ Error details:', err);
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired authentication token',
                error: 'INVALID_TOKEN',
                details: err.message
            });
        } else {
            console.log('✅ JWT verified successfully');
            console.log('Decoded payload:', decoded);
            res.locals.userId = decoded.id;
            res.locals.email = decoded.email;
            res.locals.role = decoded.role;
            next();
        }
    });
};

// Need to check whether role is master for API routes that can only be done by master
const verifyAdmin = (req, res, next) => {
    const curUserRole = res.locals.role;

    // if matches, proceed to next middleware
    if (curUserRole && curUserRole.toLowerCase() === "admin") {
        next();
    }

    // if error, return status 403
    else {
        res.status(403).send();
    }
};

// check forget password token
const checkToken = (req, res, next) => {
    // Extract the token
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    jwt.verify(token, config.JWTKey, function (error, decodedToken) {
        if (error) {
            return res.status(401).json({
                message: 'invalid or expired token'
            });
        } else {
            console.log(decodedToken)
            res.locals.email = decodedToken.email;
            res.locals.randomId = decodedToken.randomId;
            next();
        }
    });
}

const validatePassword = (req, res, next) => {
    var password = req.body.password;
    var rePassword = new RegExp(`^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})`);//at least 1 number, special character and upper case 
    if (rePassword.test(password)) {
        console.log("password condition are met")
        next();
    } else {
        return res.status(400).send({ message: "Password must include at least 1 number, special character and upper case " });
    }
}

export {
    verifyToken,
    verifyAdmin,
    checkToken,
    validatePassword
};