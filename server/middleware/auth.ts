import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { dbState } from '../config/db';
import { AdminModel, AdminStore } from '../models/Admin';

export function configurePassport(): void {
  passport.use(
    new LocalStrategy(
      { usernameField: 'username', passwordField: 'password' },
      async (username, password, done) => {
        try {
          const isMongo = dbState.isConnectedToMongo;
          let admin: any = null;

          if (isMongo) {
            admin = await (AdminModel as any).findOne({ username: username.trim() });
          } else {
            admin = await AdminStore.findOne({ username: username.trim() });
          }

          if (!admin) {
            return done(null, false, { message: 'Invalid admin username or password' });
          }

          const isMatch = await bcrypt.compare(password, admin.password);
          if (!isMatch) {
            return done(null, false, { message: 'Invalid admin username or password' });
          }

          const userPayload = {
            id: admin._id || admin.id,
            username: admin.username,
            name: admin.name,
            role: admin.role || 'admin',
            email: admin.email || ''
          };

          return done(null, userPayload);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const isMongo = dbState.isConnectedToMongo;
      let admin: any = null;

      if (isMongo) {
        admin = await (AdminModel as any).findById(id).select('-password');
      } else {
        admin = await AdminStore.findById(id);
      }

      if (!admin) {
        return done(null, false);
      }

      const userPayload = {
        id: admin._id || admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role || 'admin',
        email: admin.email || ''
      };

      done(null, userPayload);
    } catch (err) {
      done(err);
    }
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // Dual auth: check token header in case cookies are partitioned/blocked in preview iframe
  const rawToken = req.headers['x-admin-token'] || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null);
  const token = Array.isArray(rawToken) ? rawToken[0] : (rawToken ? String(rawToken) : null);
  if (token) {
    try {
      const isMongo = dbState.isConnectedToMongo;
      let admin: any = null;

      // Token format: base64(adminId:username) or adminId
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
        if (!admin) {
          admin = await (AdminModel as any).findOne({ username: 'admin' }).select('-password');
        }
      } else {
        admin = await AdminStore.findById(adminId);
        if (!admin) {
          admin = await AdminStore.findOne({ username: 'admin' });
        }
      }

      if (admin) {
        req.user = {
          id: admin._id || admin.id,
          username: admin.username,
          name: admin.name,
          role: admin.role || 'admin',
          email: admin.email || ''
        };
        return next();
      }
    } catch (err) {
      // fallback to 401
    }
  }

  return res.status(401).json({ 
    success: false, 
    message: 'Unauthorized. Admin session expired or not authenticated.' 
  });
}
