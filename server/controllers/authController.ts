import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { dbState } from '../config/db';
import { AdminModel, AdminStore } from '../models/Admin';

export const loginAdmin = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Authentication server error', error: err.message });
    }
    if (!user) {
      return res.status(401).json({ success: false, message: info?.message || 'Invalid credentials' });
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ success: false, message: 'Session login failure', error: loginErr.message });
      }
      const token = Buffer.from(`${user.id}:${user.username}`).toString('base64');
      return res.json({
        success: true,
        message: 'Admin logged in successfully',
        token,
        user
      });
    });
  })(req, res, next);
};

export const logoutAdmin = (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout error', error: err.message });
    }
    req.session.destroy((sessionErr) => {
      res.clearCookie('apartment_session_id');
      res.clearCookie('connect.sid');
      return res.json({ success: true, message: 'Logged out successfully' });
    });
  });
};

export const getSessionUser = async (req: Request, res: Response) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({
      success: true,
      isAuthenticated: true,
      user: req.user
    });
  }

  // Check token header fallback
  const rawToken = req.headers['x-admin-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
  const token = Array.isArray(rawToken) ? rawToken[0] : (rawToken ? String(rawToken) : null);
  if (token) {
    try {
      const isMongo = dbState.isConnectedToMongo;
      let admin: any = null;
      let adminId = token;
      if (token.includes(':') || token.length > 30) {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8');
          if (decoded.includes(':')) {
            adminId = decoded.split(':')[0];
          }
        } catch (_) {}
      }

      if (isMongo) {
        admin = await (AdminModel as any).findById(adminId).select('-password');
      } else {
        admin = await AdminStore.findById(adminId);
      }

      if (admin) {
        const userPayload = {
          id: admin._id || admin.id,
          username: admin.username,
          name: admin.name,
          role: admin.role || 'admin',
          email: admin.email || ''
        };
        return res.json({
          success: true,
          isAuthenticated: true,
          user: userPayload
        });
      }
    } catch (err) {}
  }

  return res.json({
    success: true,
    isAuthenticated: false,
    user: null
  });
};

export const updateAdminProfile = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { name, email, phone, currentPassword, newPassword } = req.body;
    const isMongo = dbState.isConnectedToMongo;

    let admin: any = isMongo 
      ? await (AdminModel as any).findById(user.id)
      : await AdminStore.findById(user.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password' });
      }
      const isMatch = await bcrypt.compare(currentPassword, admin.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(newPassword, salt);
    }

    if (name) admin.name = name;
    if (email !== undefined) admin.email = email;
    if (phone !== undefined) admin.phone = phone;

    if (isMongo) {
      await admin.save();
    } else {
      await AdminStore.findByIdAndUpdate(user.id, {
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        password: admin.password
      });
    }

    return res.json({
      success: true,
      message: 'Admin profile updated successfully',
      user: {
        id: admin._id || admin.id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
};
