import crypto from 'node:crypto';
import { db } from './db.js';

export const ADMIN_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-sn_admin' : 'sn_admin';

export function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token) {
      return res.status(401).json({ error: 'Admin login required' });
    }

    const tokenHash = hashSessionToken(token);
    const result = await db.query(
      `SELECT a.id, a.email, s.id AS session_id
       FROM admin_sessions s
       JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (!result.rowCount) {
      return res.status(401).json({ error: 'Session expired; log in again' });
    }

    req.admin = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      sessionId: result.rows[0].session_id
    };
    return next();
  } catch (error) {
    return next(error);
  }
}
