require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/configs/db.config');
const User = require('../src/models/user.model');

const verifySessionNull = async () => {
    await connectDB();

    try {
        console.log('Testing User.create with session: null...');
        const tempUsername = 'tempuser_' + Date.now();
        const createdUsers = await User.create([
            {
                firstName: 'Temp',
                lastName: 'User',
                username: tempUsername,
                email: tempUsername + '@example.com',
                password: 'Password123!',
                dob: new Date('2000-01-01'),
                gender: 'male',
                role: 'user',
                isEmailVerified: true
            }
        ], { session: null });

        console.log('Successfully created user:', createdUsers[0].username);

        console.log('Testing deletion with session: null...');
        const deleteResult = await User.deleteOne({ username: tempUsername }, { session: null });
        console.log('Successfully deleted user, deletedCount:', deleteResult.deletedCount);
    } catch (error) {
        console.error('Error during test:', error);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB connection closed.');
    }
};

verifySessionNull();
