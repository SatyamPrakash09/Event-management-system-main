import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function parseDurationToMs(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // fallback 15 mins
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return value;
  }
}

export function generateJwtToken(payload) {
  return jwt.sign(
    payload,
    env.jwtSecret || 'testsecret',
    { expiresIn: env.jwtExpiresIn || '7d' }
  );
}

export function generateAccessToken(payload) {
  return jwt.sign(
    payload,
    env.jwtSecret,
    { expiresIn: env.accessTokenExpiresIn }
  );
}

export function generateRefreshToken(payload) {
  return jwt.sign(
    payload,
    env.jwtSecret,
    { expiresIn: env.refreshTokenExpiresIn }
  );
}

export function verifyJwtToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
