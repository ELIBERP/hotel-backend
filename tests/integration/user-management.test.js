/**
 * User Management Database Integration Tests
 * 
 * Tests core user functionality including registration, authentication,
 * and data integrity for the hotel booking platform.
 */

import { pool } from '../../config/database.js';
import UserModel from '../../model/userModel.js';

describe('User Management Database Integration', () => {
    beforeEach(async () => {
        // Clean test data before each test
        await pool.execute('DELETE FROM users WHERE email LIKE "test.user.%@%"');
    });

    afterAll(async () => {
        // Final cleanup
        await pool.execute('DELETE FROM users WHERE email LIKE "test.user.%@%"');
        await pool.end();
    });

    describe('User Registration', () => {
        test('should successfully create a new user with valid data', async () => {
            const userData = {
                email: 'test.user.registration@example.com',
                password: 'SecurePassword123!',
                firstName: 'John',
                lastName: 'Doe',
                phone: '+65 9123 4567'
            };

            const user = await UserModel.createUser(userData);

            expect(user).toBeDefined();
            expect(user.id).toBeDefined();
            expect(user.email).toBe(userData.email);
            expect(user.firstName).toBe(userData.firstName);
            expect(user.lastName).toBe(userData.lastName);
            expect(user.phone).toBe(userData.phone);
            expect(user.password).toBeUndefined(); // Password should not be returned
        });

        test('should hash passwords securely', async () => {
            const userData = {
                email: 'test.user.password@example.com',
                password: 'MySecretPassword',
                firstName: 'Jane',
                lastName: 'Smith'
            };

            await UserModel.createUser(userData);
            
            // Verify password is hashed in database
            const [rows] = await pool.execute(
                'SELECT password_hash FROM users WHERE email = ?',
                [userData.email]
            );

            expect(rows[0].password_hash).not.toBe(userData.password);
            expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
        });
    });

    describe('User Authentication', () => {
        beforeEach(async () => {
            // Create test user for authentication tests
            await UserModel.createUser({
                email: 'test.user.auth@example.com',
                password: 'TestPassword123',
                firstName: 'Test',
                lastName: 'User'
            });
        });

        test('should find user by email', async () => {
            const user = await UserModel.findByEmail('test.user.auth@example.com');

            expect(user).toBeDefined();
            expect(user.email).toBe('test.user.auth@example.com');
            expect(user.first_name).toBe('Test');
            expect(user.last_name).toBe('User');
        });

        test('should return null for non-existent email', async () => {
            const user = await UserModel.findByEmail('nonexistent@example.com');
            expect(user).toBeNull();
        });

        test('should verify correct password', async () => {
            const user = await UserModel.findByEmail('test.user.auth@example.com');
            const isValid = await UserModel.verifyPassword('TestPassword123', user.password_hash);
            
            expect(isValid).toBe(true);
        });

        test('should reject incorrect password', async () => {
            const user = await UserModel.findByEmail('test.user.auth@example.com');
            const isValid = await UserModel.verifyPassword('WrongPassword', user.password_hash);
            
            expect(isValid).toBe(false);
        });
    });

    describe('User Data Management', () => {
        let testUserId;

        beforeEach(async () => {
            const user = await UserModel.createUser({
                email: 'test.user.update@example.com',
                password: 'TestPassword123',
                firstName: 'Original',
                lastName: 'Name',
                phone: '+65 1111 1111'
            });
            testUserId = user.id;
        });

        test('should update user information', async () => {
            const updateData = {
                firstName: 'Updated',
                lastName: 'Name',
                phone: '+65 9999 9999'
            };

            const success = await UserModel.updateUser(testUserId, updateData);
            expect(success).toBe(true);

            const updatedUser = await UserModel.findById(testUserId);
            expect(updatedUser.first_name).toBe('Updated');
            expect(updatedUser.phone).toBe('+65 9999 9999');
        });

        test('should handle GDPR compliance with user deletion', async () => {
            const success = await UserModel.deleteUser(testUserId);
            expect(success).toBe(true);

            // User should still exist but with anonymized email
            const deletedUser = await UserModel.findById(testUserId);
            expect(deletedUser).toBeDefined();
            expect(deletedUser.email).toContain('DELETED_');
        });
    });

    describe('Data Integrity', () => {
        test('should maintain consistent timestamps', async () => {
            const user = await UserModel.createUser({
                email: 'test.user.timestamps@example.com',
                password: 'TestPassword123',
                firstName: 'Time',
                lastName: 'Test'
            });

            const dbUser = await UserModel.findById(user.id);
            expect(dbUser.created_at).toBeDefined();
            expect(dbUser.updated_at).toBeDefined();
            expect(new Date(dbUser.created_at)).toBeInstanceOf(Date);
        });

        test('should handle null optional fields gracefully', async () => {
            const userData = {
                email: 'test.user.minimal@example.com',
                password: 'TestPassword123',
                firstName: 'Min',
                lastName: 'User'
                // phone intentionally omitted
            };

            const user = await UserModel.createUser(userData);
            expect(user.id).toBeDefined();
            
            const dbUser = await UserModel.findById(user.id);
            expect(dbUser.phone).toBeNull();
        });
    });
});
