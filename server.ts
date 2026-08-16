import express from 'express';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

import { connectDB } from './server/config/db';
import { seedInitialData } from './server/config/seedData';
import { configurePassport } from './server/middleware/auth';

import authRoutes from './server/routes/authRoutes';
import flatsRoutes from './server/routes/flatsRoutes';
import maintenanceRoutes from './server/routes/maintenanceRoutes';
import expensesRoutes from './server/routes/expensesRoutes';
import tasksRoutes from './server/routes/tasksRoutes';
import reportsRoutes from './server/routes/reportsRoutes';
import exportRoutes from './server/routes/exportRoutes';
import settingsRoutes from './server/routes/settingsRoutes';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for reverse proxy / iframe environments
  app.set('trust proxy', 1);

 // Initialize DB
await connectDB();

// Seed only when explicitly enabled
if (process.env.SEED_DATA === 'true') {
  await seedInitialData();
}
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session configuration
  app.use(
    session({
      name: 'apartment_session_id',
      secret: process.env.SESSION_SECRET || 'apartment_mgmt_super_secret_session_key_2026',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
      }
    })
  );

  // Passport configuration
  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/flats', flatsRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/expenses', expensesRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/settings', settingsRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Apartment Management System API',
      timestamp: new Date().toISOString()
    });
  });

  // Vite middleware for development vs Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Apartment Management System running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
