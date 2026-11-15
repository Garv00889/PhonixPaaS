const assert = require('assert');

async function testFullFlow() {
  console.log('========================================================');
  console.log('🧪 Starting PhonixPaaS Complete Flow Test Suite');
  console.log('========================================================\n');

  const BASE_URL = 'http://localhost:4000';

  // 1. Landing Page Test
  console.log('1️⃣ Testing Landing Page (GET /)...');
  const landingRes = await fetch(`${BASE_URL}/`);
  assert.strictEqual(landingRes.status, 200, 'Landing page should return 200 OK');
  const landingHtml = await landingRes.text();
  assert(landingHtml.includes('PhonixPaaS'), 'Landing page should contain "PhonixPaaS" branding');
  assert(landingHtml.includes('deployFlowModal'), 'Landing page should include deployment flow modal');
  assert(landingHtml.includes('handleDeployClick'), 'Landing page should have handleDeployClick handler');
  console.log('   ✅ Landing page verified successfully. (Size:', landingHtml.length, 'bytes)\n');

  // 2. Unauthenticated Dashboard Route Protection
  console.log('2️⃣ Testing Protected Dashboard Route (GET /dashboard without auth)...');
  const dashNoAuthRes = await fetch(`${BASE_URL}/dashboard`, {
    headers: { accept: 'text/html' },
    redirect: 'manual'
  });
  assert.strictEqual(dashNoAuthRes.status, 302, 'Unauthenticated /dashboard must return 302 redirect');
  const location = dashNoAuthRes.headers.get('location');
  assert(location.includes('/login?redirect='), `Should redirect to /login with redirect param, got: ${location}`);
  console.log(`   ✅ Correctly redirected unauthenticated user to: ${location}\n`);

  // 3. Login Page Test
  console.log('3️⃣ Testing Login Page (GET /login)...');
  const loginRes = await fetch(`${BASE_URL}/login`);
  assert.strictEqual(loginRes.status, 200, 'Login page should return 200 OK');
  const loginHtml = await loginRes.text();
  assert(loginHtml.includes('Sign In — PhonixPaaS'), 'Login page must have PhonixPaaS title');
  assert(loginHtml.includes('signInEmail') && loginHtml.includes('signInPassword'), 'Login page must have email & password fields');
  assert(loginHtml.includes('togglePasswordVisibility'), 'Login page must have show/hide password toggle');
  assert(loginHtml.includes('signUpForm'), 'Login page must have sign up form');
  assert(loginHtml.includes('forgotForm'), 'Login page must have forgot password form');
  console.log('   ✅ Login page elements and forms verified successfully.\n');

  // 4. Authentication API (Negative & Positive)
  console.log('4️⃣ Testing Authentication API...');
  
  // 4a. Bad credentials
  const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@phonixpaas.io', password: 'WrongPassword!' })
  });
  assert.strictEqual(badLogin.status, 401, 'Bad credentials must return 401');
  const badJson = await badLogin.json();
  assert.strictEqual(badJson.success, false);
  console.log('   ✅ Rejected invalid credentials correctly.');

  // 4b. Valid admin login
  const goodLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@phonixpaas.io', password: 'AdminPassword2026!' })
  });
  assert.strictEqual(goodLogin.status, 200, 'Valid credentials must return 200');
  const goodJson = await goodLogin.json();
  assert.strictEqual(goodJson.success, true);
  assert(goodJson.token, 'Should return session token');
  const authCookie = goodLogin.headers.get('set-cookie');
  assert(authCookie && authCookie.includes('phonix_token'), 'Should set phonix_token cookie');
  console.log('   ✅ Admin authentication succeeded. Token generated.');

  // 4c. Verify /api/auth/me with session cookie
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { cookie: authCookie }
  });
  assert.strictEqual(meRes.status, 200);
  const meJson = await meRes.json();
  assert.strictEqual(meJson.success, true);
  assert.strictEqual(meJson.user.email, 'admin@phonixpaas.io');
  console.log('   ✅ Verified /api/auth/me session identity:', meJson.user.email);

  // 4d. Register new user test
  const testEmail = `dev-${Date.now()}@test.phonixpaas.io`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Engineer',
      email: testEmail,
      password: 'SecurePassword123!'
    })
  });
  assert.strictEqual(regRes.status, 200, 'Registration should succeed');
  const regJson = await regRes.json();
  assert.strictEqual(regJson.success, true);
  assert.strictEqual(regJson.user.email, testEmail);
  console.log('   ✅ User registration verified for:', testEmail, '\n');

  // 5. Authenticated Dashboard Access
  console.log('5️⃣ Testing Authenticated Dashboard Access (GET /dashboard with cookie)...');
  const dashAuthRes = await fetch(`${BASE_URL}/dashboard`, {
    headers: { cookie: authCookie, accept: 'text/html' },
    redirect: 'manual'
  });
  assert.strictEqual(dashAuthRes.status, 200, 'Authenticated dashboard must return 200');
  const dashHtml = await dashAuthRes.text();
  assert(dashHtml.includes('PhonixPaaS Dashboard'), 'Dashboard should have correct branding');
  assert(dashHtml.includes('deploymentSuccessToast'), 'Dashboard should include deployment success toast');
  console.log('   ✅ Authenticated user access granted to Dashboard.\n');

  // 6. Deployment Flow Test
  console.log('6️⃣ Testing Deployment Flow...');
  
  // 6a. Unauthenticated deployment blocked
  const unauthDeploy = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'unauthorized-test' })
  });
  assert.strictEqual(unauthDeploy.status, 401, 'Unauthenticated deployment must return 401');
  console.log('   ✅ Unauthenticated deployment blocked with 401.');

  // 6b. Authenticated project deployment
  const testProjectName = `phonix-test-${Date.now() % 10000}`;
  const deployRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: authCookie
    },
    body: JSON.stringify({
      name: testProjectName,
      category: 'api',
      gitUrl: '',
      branch: 'main',
      buildCmd: '',
      startCmd: 'node -v'
    })
  });
  assert.strictEqual(deployRes.status, 200, 'Authenticated deployment should succeed');
  const deployJson = await deployRes.json();
  assert.strictEqual(deployJson.success, true);
  const newProject = deployJson.data;
  console.log(`   ✅ Project created: "${newProject.name}" (ID: ${newProject.id}) on Port ${newProject.port}`);

  // 6c. Project start & status check
  const startRes = await fetch(`${BASE_URL}/api/projects/${newProject.id}/start`, {
    method: 'POST',
    headers: { cookie: authCookie }
  });
  const startJson = await startRes.json();
  assert.strictEqual(startJson.success, true);
  console.log(`   ✅ Project process started successfully. Running: ${startJson.data?.isRunning}`);

  // Clean up test project
  await fetch(`${BASE_URL}/api/projects/${newProject.id}`, {
    method: 'DELETE',
    headers: { cookie: authCookie }
  });
  console.log(`   🧹 Cleaned up test project.\n`);

  console.log('========================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================');
}

testFullFlow().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
