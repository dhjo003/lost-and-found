import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

export async function createTestUser() {
  // Try requesting a server-signed token first (preferred for E2E/CI).
  // This avoids needing DB access or matching local signing keys.
  const apiBase = process.env.VITE_API_BASE_URL || 'http://localhost:5298';
  const isCI = !!(process.env.CI || process.env.GITHUB_ACTIONS);
  const maxAttempts = isCI ? 20 : 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${apiBase}/api/test/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: 'playwright@test.local', GoogleId: 'playwright-test-1', FirstName: 'Playwright', LastName: 'Tester' })
      });
      if (res.ok) {
        const body = await res.json();
        return { token: body.token, user: body.user };
      }
      // non-OK: if not last attempt, wait and retry
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000));
      else {
        // In CI we want a clear failure instead of falling back to DB (which often isn't available)
        if (isCI) {
          throw new Error('createTestUser: server token endpoint unreachable after retries in CI');
        }
        console.warn('createTestUser: server token request failed', e && e.message ? e.message : e);
      }
    }
  }

  // If we reach here the server token endpoint never returned a successful response.
  // In CI we must fail fast (do not attempt DB access). In local/dev we still allow
  // the DB fallback for convenience.
  if (isCI) {
    throw new Error('createTestUser: server token endpoint did not return a successful response after retries in CI');
  }

  // Read backend appsettings to get DB and JWT config (fallback)
  const cfgPath = fileURLToPath(new URL('../../../../backend/LostAndFoundApp/appsettings.Development.json', import.meta.url));
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const connStr = cfg.ConnectionStrings.DefaultConnection;
  // parse simple connection string like 'server=localhost;user=root;password=root;database=lostandfounddb'
  const parts = {};
  connStr.split(';').forEach(p => {
    const [k, v] = p.split('='); if (!k) return; parts[k.trim().toLowerCase()] = (v || '').trim();
  });

  const host = parts.server || parts.host || 'localhost';
  const user = parts.user || parts.uid || 'root';
  const password = parts.password || parts.pwd || '';
  const database = parts.database || parts.db || 'lostandfounddb';

  const conn = await mysql.createConnection({ host, user, password, database });

  const testGoogleId = 'playwright-test-1';
  const testEmail = 'playwright@test.local';
  const firstName = 'Playwright';
  const lastName = 'Tester';

  // ensure a user exists
  const [rows] = await conn.execute('SELECT Id, Email, FirstName, LastName, RoleId FROM Users WHERE GoogleId = ? OR Email = ? LIMIT 1', [testGoogleId, testEmail]);
  let userId;
  let roleId = 1;
  if (rows && rows.length > 0) {
    userId = rows[0].Id;
    roleId = rows[0].RoleId || 1;
    // update basic fields
    await conn.execute('UPDATE Users SET Email = ?, FirstName = ?, LastName = ?, IsDeleted = 0 WHERE Id = ?', [testEmail, firstName, lastName, userId]);
  } else {
    const now = new Date();
    const [ins] = await conn.execute('INSERT INTO Users (GoogleId, Email, FirstName, LastName, RoleId, CreatedAt, LastLogin, IsDeleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)', [testGoogleId, testEmail, firstName, lastName, roleId, now, now]);
    userId = ins.insertId;
  }

  // determine role name
  const [roleRows] = await conn.execute('SELECT Name FROM Roles WHERE RoleId = ?', [roleId]);
  const roleName = (roleRows && roleRows[0] && roleRows[0].Name) ? roleRows[0].Name : 'User';

  await conn.end();

  // create JWT matching server settings
  // Prefer an explicit environment override (useful when the backend is started
  // with a different Jwt:Key at runtime). Fall back to the development config,
  // and finally to the special Testing key used when ASPNETCORE_ENVIRONMENT=Testing.
  const envKey = process.env.TEST_JWT_KEY || process.env.ASPNETCORE_TEST_JWT_KEY;
  const aspnetEnv = process.env.ASPNETCORE_ENVIRONMENT || process.env.NODE_ENV || '';
  const testingFallbackKey = 'TestSecretKey_DoNotUse_InProduction_ChangeThis';

  const jwtKey = envKey || (aspnetEnv.toLowerCase() === 'testing' ? testingFallbackKey : (cfg.Jwt?.Key || 'ReplaceWithAStrongSecretKeyChangeInProduction!'));
  const jwtIssuer = cfg.Jwt?.Issuer || 'LostAndFoundApp';
  const jwtAudience = cfg.Jwt?.Audience || 'LostAndFoundAppAudience';

  const payload = {
    sub: String(userId),
    // include the .NET claim type names so Role and NameIdentifier are present
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': String(userId),
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': roleName,
    email: testEmail
  };

  const token = jwt.sign(payload, jwtKey, { algorithm: 'HS256', issuer: jwtIssuer, audience: jwtAudience, expiresIn: '12h' });

  const userObj = { id: userId, email: testEmail, firstName, lastName, avatarUrl: `/api/users/${userId}/avatar`, roleName };

  return { token, user: userObj };
}
