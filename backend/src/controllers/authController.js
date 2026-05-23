import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken, parseDurationToMs } from '../utils/generateToken.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: parseDurationToMs(env.accessTokenExpiresIn || '15m'),
  path: '/'
});

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: parseDurationToMs(env.refreshTokenExpiresIn || '7d'),
  path: '/'
});

const handleAuthError = (res, err) => {
  console.error('ERROR:', err);

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Email already exists',
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: Object.values(err.errors).map((error) => error.message).join(', '),
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.',
  });
};

export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });
    
    const user = await User.create({ name, email, password, role });
    
    const accessToken = generateAccessToken({ id: user._id, role: user.role, name: user.name });
    const refreshToken = generateRefreshToken({ id: user._id });
    
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('authToken', accessToken, getCookieOptions());
    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    res.status(201).json({ 
      token: accessToken, 
      user: { id: user._id, name: user.name, email: user.email, role: user.role } 
    });
  } catch (err) {
    return handleAuthError(res, err);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (user.isBlocked) return res.status(403).json({ message: 'User is blocked' });
    const valid = await user.comparePassword(password);
    if (!valid) return res.status(400).json({ message: 'Invalid credentials' });
    
    const accessToken = generateAccessToken({ id: user._id, role: user.role, name: user.name });
    const refreshToken = generateRefreshToken({ id: user._id });
    
    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('authToken', accessToken, getCookieOptions());
    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    res.json({ 
      token: accessToken, 
      user: { id: user._id, name: user.name, email: user.email, role: user.role } 
    });
  } catch (err) {
    return handleAuthError(res, err);
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies ? req.cookies.refreshToken : null;
    if (refreshToken) {
      await User.findOneAndUpdate(
        { refreshToken },
        { $unset: { refreshToken: 1 } }
      );
    }

    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return handleAuthError(res, err);
  }
};

export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies ? req.cookies.refreshToken : null;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.jwtSecret || 'testsecret');
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Token is invalid or has been revoked' });
    }

    const newAccessToken = generateAccessToken({ id: user._id, role: user.role, name: user.name });
    const newRefreshToken = generateRefreshToken({ id: user._id });
    
    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie('authToken', newAccessToken, getCookieOptions());
    res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());

    res.json({
      success: true,
      token: newAccessToken
    });
  } catch (err) {
    return handleAuthError(res, err);
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, points: user.points, phoneNumber: user.phoneNumber, avatarUrl: user.avatarUrl } });
  } catch (err) {
    return handleAuthError(res, err);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, email, phoneNumber, avatarUrl } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (avatarUrl) updates.avatarUrl = avatarUrl;

    if (email) {
      const existing = await User.findOne({ email });
      if (existing && existing._id.toString() !== req.user.id) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).lean();
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        points: user.points,
        phoneNumber: user.phoneNumber,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (err) {
    return handleAuthError(res, err);
  }
};
