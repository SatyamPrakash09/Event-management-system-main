import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function authenticate(req, res, next) {
  let token = req.cookies ? req.cookies.authToken : null;

  if (!token) {
    const authHeader = req.headers.authorization || '';
    token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  }

  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, env.jwtSecret || 'testsecret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}


