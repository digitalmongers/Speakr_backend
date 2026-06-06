require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');
const tokenService = require('../src/services/token.service');
const authService = require('../src/services/auth.service');
const adminUserService = require('../src/services/admin/adminUser.service');
const userRepository = require('../src/repositories/user.repository');
const httpStatus = require('http-status').default;

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    let testUserId = null;

    try {
        console.log('Cleaning up existing test user...');
        await User.deleteMany({ username: 'testblockeduser' });

        console.log('Creating verified test user...');
        const user = await User.create({
            firstName: 'Blocked',
            lastName: 'Test',
            username: 'testblockeduser',
            email: 'testblockeduser@speakr.com',
            password: 'Password123!',
            dob: new Date('1995-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
        });
        testUserId = user._id;

        console.log('1. Simulating login: generating JWT tokens...');
        const tokens = await tokenService.generateAuthTokens(user);
        const accessToken = tokens.access.token;
        console.log('Generated accessToken:', accessToken);

        // Simulate userAuth middleware checks
        const checkAuth = async (token) => {
            const payload = tokenService.verifyToken(token);
            const sessionUser = await userRepository.getUserForSession(payload.sub);
            if (!sessionUser) {
                throw new Error('User not found in session');
            }
            if (payload.v !== sessionUser.tokenVersion) {
                throw new Error('Session expired');
            }
            if (sessionUser.isBlocked) {
                throw new Error('Your account has been blocked');
            }
            return sessionUser;
        };

        console.log('2. Verifying auth checks succeed for active token...');
        const authUserBefore = await checkAuth(accessToken);
        console.log('Auth check succeeded for user tokenVersion:', authUserBefore.tokenVersion);

        console.log('3. Blocking user via adminUserService.toggleUserBlock...');
        const blockRes = await adminUserService.toggleUserBlock(testUserId);
        console.log('Block result:', blockRes);

        if (!blockRes.isBlocked) {
            throw new Error('User was not blocked');
        }

        console.log('4. Verifying immediate session invalidation: verifying old JWT token fails...');
        try {
            await checkAuth(accessToken);
            throw new Error('Expected old token authentication to fail after block, but it succeeded!');
        } catch (err) {
            console.log('✅ Session check failed as expected:', err.message);
            if (err.message !== 'Session expired' && err.message !== 'Your account has been blocked') {
                throw new Error(`Unexpected error message: ${err.message}`);
            }
        }

        console.log('5. Verifying login prevention for blocked user...');
        try {
            await authService.login('testblockeduser@speakr.com', 'Password123!');
            throw new Error('Expected login to fail for blocked user, but it succeeded!');
        } catch (err) {
            console.log('✅ Login failed as expected:', err.message);
            if (err.statusCode !== 403 || err.message !== 'Your account has been blocked') {
                throw new Error(`Unexpected login error: ${err.statusCode} - ${err.message}`);
            }
        }

        console.log('6. Unblocking user via adminUserService.toggleUserBlock...');
        const unblockRes = await adminUserService.toggleUserBlock(testUserId);
        console.log('Unblock result:', unblockRes);

        if (unblockRes.isBlocked) {
            throw new Error('User was not unblocked');
        }

        console.log('7. Verifying login works again for unblocked user...');
        const loggedInUser = await authService.login('testblockeduser@speakr.com', 'Password123!');
        console.log('✅ Login succeeded for unblocked user:', loggedInUser.username);

        console.log('8. Verifying auth checks succeed with a new login token...');
        const newTokens = await tokenService.generateAuthTokens(loggedInUser);
        const newAuthUser = await checkAuth(newTokens.access.token);
        console.log('✅ Auth check succeeded for new token, user tokenVersion:', newAuthUser.tokenVersion);

        console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('Cleaning up test user...');
        if (testUserId) {
            await User.findByIdAndDelete(testUserId);
        }
        console.log('Cleanup complete. Closing DB connection...');
        await mongoose.connection.close();
        console.log('DB connection closed.');
    }
};

runTest();
