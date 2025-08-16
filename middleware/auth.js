import jwt from "jsonwebtoken";
import config from "../config/config.js";

const verifyToken = (req, res, next) => {
    // Extract the token
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    // Check for missing, undefined, or "null" string token
    if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({
            success: false,
            message: 'No authentication token provided',
            error: 'MISSING_TOKEN'
        });
    }

    // Proceed to verify localStorage's token against secret key
    jwt.verify(token, config.JWTKey, (err, decoded) => {
        // If error, incorrect secret key used
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired authentication token',
                error: 'INVALID_TOKEN',
                details: err.message
            });
        } else {
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