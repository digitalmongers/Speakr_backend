require('dotenv').config();
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api/v1';

const runTests = async () => {
    console.log('🚀 Starting System Settings and upload validation tests...');

    // Connect to database to fetch OTP
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    // 1. Log in as admin
    console.log('1. Logging in as Admin...');
    const loginRes = await fetch(`${BASE_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@speakr.com',
            password: 'SpeakrAdminPassword2026!',
        }),
    });
    
    if (!loginRes.ok) {
        const errText = await loginRes.text();
        throw new Error(`Admin login failed: ${loginRes.status} - ${errText}`);
    }
    
    const loginData = await loginRes.json();
    const token = loginData.data.tokens.access.token;
    console.log('✅ Admin logged in successfully.');

    const adminHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    // 2. Fetch current settings (default values)
    console.log('2. Fetching current settings...');
    const getRes = await fetch(`${BASE_URL}/admin/settings`, {
        headers: adminHeaders,
    });
    if (!getRes.ok) throw new Error('Failed to fetch settings');
    const getData = await getRes.json();
    console.log(`✅ Current settings:`, getData.data);

    // 2b. Fetch public settings
    console.log('2b. Fetching public settings...');
    const publicGetRes = await fetch(`${BASE_URL}/settings`);
    if (!publicGetRes.ok) throw new Error('Failed to fetch public settings');
    const publicGetData = await publicGetRes.json();
    console.log(`✅ Public settings:`, publicGetData.data);
    if (publicGetData.data.maxAudioSizeMB !== getData.data.maxAudioSizeMB) {
        throw new Error('Public audio size does not match admin setting');
    }
    if (publicGetData.data.maxImageSizeMB !== 10) {
        throw new Error('Public image size is not 10MB');
    }

    // 3. Update limit to 1MB
    console.log('3. Updating maxAudioSizeMB to 1MB...');
    const patchRes = await fetch(`${BASE_URL}/admin/settings`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({
            maxAudioSizeMB: 1,
        }),
    });
    if (!patchRes.ok) throw new Error('Failed to update settings');
    console.log('✅ Limit set to 1MB successfully.');

    // 4. Test uploading a file larger than 1MB (e.g. 1.2MB)
    console.log('4. Testing upload of 1.2MB audio file (should fail)...');
    
    // Create a 1.2MB dummy file buffer (1.2 * 1024 * 1024 bytes)
    const dummySize = Math.floor(1.2 * 1024 * 1024);
    const dummyBuffer = Buffer.alloc(dummySize, 'a');
    const fileBlob = new Blob([dummyBuffer], { type: 'audio/mpeg' });
    
    const formData = new FormData();
    formData.append('file', fileBlob, 'test-audio.mp3');

    // Register a temporary user
    console.log('4b. Registering a temporary user for upload...');
    const timestamp = Date.now();
    const regEmail = `testuser_${timestamp}@example.com`;
    const regUsername = `testuser_${timestamp}`;
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            firstName: 'Test',
            lastName: 'User',
            username: regUsername,
            email: regEmail,
            password: 'UserPassword123!',
            dob: '2000-01-01',
            gender: 'male',
        }),
    });
    
    if (!signupRes.ok) {
        const txt = await signupRes.text();
        throw new Error(`User signup failed: ${signupRes.status} - ${txt}`);
    }
    console.log('✅ Signup initiated. Retrieving OTP from database...');

    // Wait a brief moment and fetch the OTP
    await new Promise(resolve => setTimeout(resolve, 1000));
    const pendingUser = await mongoose.connection.db.collection('pendingusers').findOne({ email: regEmail });
    if (!pendingUser) {
        throw new Error(`Pending user registration record not found in database for email: ${regEmail}`);
    }
    const otp = pendingUser.otp;
    console.log(`✅ Retrieved OTP: ${otp}. Verifying OTP...`);

    // Verify OTP
    const verifyRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: regEmail,
            otp: otp,
        }),
    });

    if (!verifyRes.ok) {
        const txt = await verifyRes.text();
        throw new Error(`OTP verification failed: ${verifyRes.status} - ${txt}`);
    }
    const verifyData = await verifyRes.json();
    const userToken = verifyData.data.tokens.access.token;
    console.log('✅ OTP verified successfully. User logged in.');

    const userHeaders = {
        'Authorization': `Bearer ${userToken}`,
    };

    // Attempt to upload larger file
    console.log('Uploading 1.2MB audio file...');
    const uploadRes1 = await fetch(`${BASE_URL}/upload/audio`, {
        method: 'POST',
        headers: userHeaders,
        body: formData,
    });

    console.log(`Upload status: ${uploadRes1.status}`);
    if (uploadRes1.status !== 413) {
        const txt = await uploadRes1.text();
        throw new Error(`Upload should have been rejected with 413 Payload Too Large. Got: ${uploadRes1.status} - ${txt}`);
    }
    console.log('✅ Upload successfully rejected with 413 File size limit exceeded.');

    // 5. Restore limit to 50MB
    console.log('5. Restoring maxAudioSizeMB back to 50MB...');
    const restoreRes = await fetch(`${BASE_URL}/admin/settings`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({
            maxAudioSizeMB: 50,
        }),
    });
    if (!restoreRes.ok) throw new Error('Failed to restore settings');
    console.log('✅ Limit restored to 50MB successfully.');

    // 6. Attempt upload again (should pass)
    console.log('6. Testing upload again with 50MB limit (should pass or fail with config issue, not 413)...');
    const uploadRes2 = await fetch(`${BASE_URL}/upload/audio`, {
        method: 'POST',
        headers: userHeaders,
        body: formData,
    });

    console.log(`Upload status: ${uploadRes2.status}`);
    if (uploadRes2.status === 413) {
        throw new Error('Upload was rejected with 413 but the limit was set to 50MB');
    }
    console.log('✅ Dynamic limit successfully verified. Upload bypassed size limit checks.');

    // Clean up test database entries
    console.log('Cleaning up database...');
    await mongoose.connection.db.collection('users').deleteOne({ email: regEmail });
    console.log('✅ Test user cleaned up.');

    console.log('🎉 System Settings E2E tests passed successfully!');
};

runTests()
    .catch(err => {
        console.error('❌ Test execution failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
