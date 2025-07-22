import express from 'express';
import UserModel from '../model/userModel.js';

const router = express.Router();

// Test route to verify auth routes are working
router.get('/test', (req, res) => {
    res.status(200).json({ 
        message: 'Auth routes are working!',
        timestamp: new Date().toISOString()
    });
});

// Input validation helper
const validateRegistrationInput = (data) => {
    const { email, password, firstName, lastName } = data;
    const errors = [];

    if (!email || typeof email !== 'string' || !email.trim()) {
        errors.push('Email is required and must be a valid string');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.push('Email must be in valid format');
    }

    if (!password || typeof password !== 'string') {
        errors.push('Password is required and must be a string');
    } else if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }

    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
        errors.push('First name is required and must be a valid string');
    }

    if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
        errors.push('Last name is required and must be a valid string');
    }

    return errors;
};

const validateLoginInput = (data) => {
    const { email, password } = data;
    const errors = [];

    if (!email || typeof email !== 'string' || !email.trim()) {
        errors.push('Email is required and must be a valid string');
    }

    if (!password || typeof password !== 'string') {
        errors.push('Password is required and must be a string');
    }

    return errors;
};

// User Registration Route
router.post('/register', async (req, res) => {
    try {
        console.log('Registration attempt:', { email: req.body.email, hasPassword: !!req.body.password });
        
        // Validate input
        const validationErrors = validateRegistrationInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        const { email, password, firstName, lastName, phone } = req.body;
        
        // Normalize email
        const normalizedEmail = email.trim().toLowerCase();
        
        // Check if user already exists
        console.log('Checking if user exists:', normalizedEmail);
        const existingUser = await UserModel.findByEmail(normalizedEmail);
        if (existingUser) {
            console.log('User already exists:', normalizedEmail);
            return res.status(409).json({ 
                success: false,
                message: 'User with this email already exists' 
            });
        }
        
        // Create new user
        console.log('Creating new user...');
        const userData = {
            email: normalizedEmail,
            password: password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone ? phone.trim() : null
        };

        const newUser = await UserModel.createUser(userData);
        console.log('User created successfully:', newUser.id);
        
        res.status(201).json({ 
            success: true,
            message: 'User registered successfully', 
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                phone: newUser.phone,
                createdAt: newUser.createdAt
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

// User Login Route
router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
        
        // Validate input
        const validationErrors = validateLoginInput(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        const { email, password } = req.body;
        const normalizedEmail = email.trim().toLowerCase();
        
        // Find user by email
        console.log('Finding user by email:', normalizedEmail);
        const user = await UserModel.findByEmail(normalizedEmail);
        if (!user) {
            console.log('User not found:', normalizedEmail);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }
        
        // Verify password
        console.log('Verifying password for user:', user.id);
        const isPasswordValid = await UserModel.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            console.log('Invalid password for user:', user.id);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }
        
        console.log('Login successful for user:', user.id);
        
        // Return user info (without sensitive data)
        res.status(200).json({ 
            success: true,
            message: 'Login successful', 
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during login',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
});

export default { router };
