import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, initDb } from '../src/db.js';
const email=process.env.ADMIN_EMAIL;
const password=process.env.ADMIN_PASSWORD;
if(!email||!password||password.length<12){console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in the hosting environment.');process.exit(1)}
try {
  await initDb();
  const hash=await bcrypt.hash(password,12);
  await db.query('INSERT INTO admins(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash',[email.toLowerCase(),hash]);
  console.log('Admin account created/updated:',email);
} catch(e) {console.error(e);process.exitCode=1}
finally {await db.end()}
