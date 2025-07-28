import { pool } from '../config/database.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

class UserModel {
    // Create a new user
    static async createUser(userData) {
        try {
            const { email, password, firstName, lastName, phone } = userData;
            
            console.log('UserModel: Creating user with email:', email);
            
            // Hash password with salt rounds of 12 for better security
            const passwordHash = await bcrypt.hash(password, 12);
            
            // Generate unique ID
            const userId = uuidv4();
            
            const query = `
                INSERT INTO users (id, email, password_hash, first_name, last_name, phone, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;
            
            const [result] = await pool.execute(query, [
                userId, email, passwordHash, firstName, lastName, phone
            ]);
            
            console.log('UserModel: User created with ID:', userId);
            
            // Return user data without password
            return { 
                id: userId, 
                email, 
                firstName, 
                lastName, 
                phone,
                createdAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('UserModel createUser error:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('User with this email already exists');
            }
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }
    
    // Find user by email
    static async findByEmail(email) {
        try {
            console.log('UserModel: Finding user by email:', email);
            const query = 'SELECT * FROM users WHERE email = ?';
            const [rows] = await pool.execute(query, [email]);
            
            const user = rows[0] || null;
            console.log('UserModel: User found:', !!user);
            
            return user;
        } catch (error) {
            console.error('UserModel findByEmail error:', error);
            throw new Error(`Failed to find user by email: ${error.message}`);
        }
    }
    
    // Find user by ID
    static async findById(id) {
        try {
            console.log('UserModel: Finding user by ID:', id);
            const query = 'SELECT * FROM users WHERE id = ?';
            const [rows] = await pool.execute(query, [id]);
            
            const user = rows[0] || null;
            console.log('UserModel: User found by ID:', !!user);
            
            return user;
        } catch (error) {
            console.error('UserModel findById error:', error);
            throw new Error(`Failed to find user by ID: ${error.message}`);
        }
    }
    
    // Verify password
    static async verifyPassword(plainPassword, hashedPassword) {
        try {
            console.log('UserModel: Verifying password');
            const isValid = await bcrypt.compare(plainPassword, hashedPassword);
            console.log('UserModel: Password verification result:', isValid);
            return isValid;
        } catch (error) {
            console.error('UserModel verifyPassword error:', error);
            throw new Error(`Failed to verify password: ${error.message}`);
        }
    }
    
    // Update user
    static async updateUser(id, updateData) {
        try {
            console.log('UserModel: Updating user:', id);
            const { firstName, lastName, phone } = updateData;
            
            const query = `
                UPDATE users 
                SET first_name = ?, last_name = ?, phone = ?, updated_at = NOW()
                WHERE id = ?
            `;
            
            const [result] = await pool.execute(query, [firstName, lastName, phone, id]);
            
            const success = result.affectedRows > 0;
            console.log('UserModel: User update result:', success);
            
            return success;
        } catch (error) {
            console.error('UserModel updateUser error:', error);
            throw new Error(`Failed to update user: ${error.message}`);
        }
    }
    
    // Get all users (for admin purposes - remove password hashes)
    static async getAllUsers() {
        try {
            console.log('UserModel: Getting all users');
            const query = 'SELECT id, email, first_name, last_name, phone, created_at, updated_at FROM users ORDER BY created_at DESC';
            const [rows] = await pool.execute(query);
            
            console.log('UserModel: Found', rows.length, 'users');
            return rows;
        } catch (error) {
            console.error('UserModel getAllUsers error:', error);
            throw new Error(`Failed to get users: ${error.message}`);
        }
    }
    
    // Delete user (soft delete by setting email to null and adding deleted timestamp)
    static async deleteUser(id) {
        try {
            console.log('UserModel: Deleting user:', id);
            const query = `
                UPDATE users 
                SET email = CONCAT('DELETED_', id, '_', email), 
                    deleted_at = NOW(),
                    updated_at = NOW()
                WHERE id = ? AND deleted_at IS NULL
            `;
            
            const [result] = await pool.execute(query, [id]);
            
            const success = result.affectedRows > 0;
            console.log('UserModel: User deletion result:', success);
            
            return success;
        } catch (error) {
            console.error('UserModel deleteUser error:', error);
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }
}

export default UserModel;