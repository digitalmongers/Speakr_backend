require('dotenv').config();
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api/v1';

const runTests = async () => {
    console.log('🚀 Starting Post Creation compatibility tests...');

    // 1. Log in as admin to get a valid token
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    console.log('1. Logging in as Admin...');
    const loginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
        }),
    });
    
    if (!loginRes.ok) {
        const errText = await loginRes.text();
        throw new Error(`Admin login failed: ${loginRes.status} - ${errText}`);
    }
    
    const loginData = await loginRes.json();
    const token = loginData.data.tokens.access.token;
    console.log('✅ Admin logged in successfully.');

    const headers = {
        'Authorization': `Bearer ${token}`,
    };

    // Make sure we have a category and language
    const Category = require('../src/models/category.model');
    const Language = require('../src/models/language.model');
    await Category.findOneAndUpdate({ name: 'Culture' }, { isActive: true }, { upsert: true });
    await Language.findOneAndUpdate({ name: 'French' }, { isActive: true }, { upsert: true });

    // Test Case 1: JSON body (Traditional Two-Step flow)
    console.log('\n--- Test Case 1: JSON Body (Existing Flow) ---');
    const postJsonData = {
        title: 'JSON Blog Post',
        description: 'nothing to know about this blog content',
        audioUrl: 'https://example.com/audio/sample.mp3',
        audioKey: 'audio/sample-123.mp3',
        thumbnailUrl: 'https://example.com/images/thumb.jpg',
        thumbnailKey: 'images/thumb-123.jpg',
        category: 'Culture',
        language: 'French',
        isKidsContent: 'no',
        duration: 180
    };

    const jsonRes = await fetch(`${BASE_URL}/posts`, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postJsonData)
    });

    const jsonStatus = jsonRes.status;
    const jsonBody = await jsonRes.json();
    console.log(`JSON Response Status: ${jsonStatus}`);
    console.log(`JSON Response Body:`, JSON.stringify(jsonBody, null, 2));

    if (jsonStatus !== 201) {
        throw new Error(`JSON post creation failed: ${jsonStatus}`);
    }
    console.log('✅ JSON post creation passed.');

    // Cleanup test data
    const { Post } = require('../src/models/post.model');
    if (jsonBody.data?.post?._id) {
        await Post.findByIdAndDelete(jsonBody.data.post._id);
        console.log('✅ Cleaned up JSON test post.');
    }

    console.log('\n🎉 Compatibility test finished successfully!');
};

runTests()
    .catch(err => {
        console.error('❌ Test execution failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
