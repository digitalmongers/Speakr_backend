require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');
const adminUserService = require('../src/services/admin/adminUser.service');

const runTest = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    const createdUsers = [];

    try {
        console.log('Cleaning up existing test data...');
        await User.deleteMany({ username: { $in: ['testverified1', 'testunverified2', 'testsearch3'] } });

        console.log('Creating test users...');

        // User 1: Verified (Older)
        const user1 = await User.create({
            firstName: 'VerifiedOne',
            lastName: 'Test',
            username: 'testverified1',
            email: 'verified1@speakr.com',
            password: 'Password123!',
            dob: new Date('1990-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
            createdAt: new Date('2026-06-06T10:00:00Z'),
        });
        createdUsers.push(user1._id);

        // User 2: Unverified
        const user2 = await User.create({
            firstName: 'UnverifiedTwo',
            lastName: 'Test',
            username: 'testunverified2',
            email: 'unverified2@speakr.com',
            password: 'Password123!',
            dob: new Date('1991-01-01'),
            gender: 'female',
            role: 'user',
            isEmailVerified: false,
            createdAt: new Date('2026-06-06T11:00:00Z'),
        });
        createdUsers.push(user2._id);

        // User 3: Verified for search matching (Newer)
        const user3 = await User.create({
            firstName: 'SearchThree',
            lastName: 'UniqueLastname',
            username: 'testsearch3',
            email: 'search3@speakr.com',
            password: 'Password123!',
            dob: new Date('1992-01-01'),
            gender: 'male',
            role: 'user',
            isEmailVerified: true,
            createdAt: new Date('2026-06-06T12:00:00Z'),
        });
        createdUsers.push(user3._id);

        console.log('Created test users successfully.');

        // Test 1: Fetch verified users with default limit (should include User 1 and User 3, but NOT User 2)
        console.log('--- Test 1: Retrieve all verified users ---');
        const res1 = await adminUserService.listVerifiedUsers({ limit: 10 });
        console.log(`Limit: ${res1.limit}, HasNextPage: ${res1.hasNextPage}, NextCursor: ${res1.nextCursor}`);
        
        const usernames = res1.results.map(u => u.username);
        console.log('Returned usernames:', usernames);

        if (!usernames.includes('testverified1')) {
            throw new Error('testverified1 (verified) was not found in results');
        }
        if (usernames.includes('testunverified2')) {
            throw new Error('testunverified2 (unverified) was found in results, but should be filtered out!');
        }
        if (!usernames.includes('testsearch3')) {
            throw new Error('testsearch3 (verified) was not found in results');
        }
        console.log('✅ Test 1 Passed: Correctly retrieved only verified users.');

        // Test 2: Search filtering
        console.log('--- Test 2: Search filtering by name/username/email ---');
        const res2 = await adminUserService.listVerifiedUsers({ limit: 10, search: 'UniqueLastname' });
        console.log(`HasNextPage: ${res2.hasNextPage}, NextCursor: ${res2.nextCursor}`);
        const searchUsernames = res2.results.map(u => u.username);
        console.log('Search returned usernames:', searchUsernames);

        if (searchUsernames.length !== 1 || searchUsernames[0] !== 'testsearch3') {
            throw new Error('Search did not return exactly testsearch3');
        }
        console.log('✅ Test 2 Passed: Search query correctly filtered verified users.');

        // Test 3: Cursor-based Pagination
        console.log('--- Test 3: Cursor-based Pagination ---');
        // Let's get them 1 by 1. Since we sort by createdAt descending, testsearch3 (created last) should be first, then testverified1.
        console.log('Fetching first user...');
        const page1 = await adminUserService.listVerifiedUsers({ limit: 1 });
        console.log('First user:', page1.results.map(u => u.username));
        if (page1.results.length !== 1) {
            throw new Error(`Expected exactly 1 result, got ${page1.results.length}`);
        }
        if (page1.results[0].username !== 'testsearch3') {
            throw new Error(`Expected first user to be testsearch3 (newest), got ${page1.results[0].username}`);
        }
        if (!page1.hasNextPage || !page1.nextCursor) {
            throw new Error('Expected hasNextPage and nextCursor to be returned');
        }

        console.log('Fetching second user using nextCursor...');
        const page2 = await adminUserService.listVerifiedUsers({ limit: 1, cursor: page1.nextCursor });
        console.log('Second user:', page2.results.map(u => u.username));
        if (page2.results.length !== 1) {
            throw new Error(`Expected exactly 1 result, got ${page2.results.length}`);
        }
        if (page2.results[0].username !== 'testverified1') {
            throw new Error(`Expected second user to be testverified1, got ${page2.results[0].username}`);
        }

        console.log('✅ Test 3 Passed: Cursor-based pagination behaves correctly.');

        console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('Cleaning up created users...');
        if (createdUsers.length > 0) {
            await User.deleteMany({ _id: { $in: createdUsers } });
        }
        console.log('Cleanup complete. Closing DB connection...');
        await mongoose.connection.close();
        console.log('DB connection closed.');
    }
};

runTest();
