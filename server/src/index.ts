import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import prisma from './config/db';
import authRoutes from './routes/authRoutes';
import eventRoutes from './routes/eventRoutes';
import registrationRoutes from './routes/registrationRoutes';
import ticketRoutes from './routes/ticketRoutes';
import validationRoutes from './routes/validationRoutes';
import auditRoutes from './routes/auditRoutes';
import adminRoutes from './routes/adminRoutes';
import { errorHandler } from './middleware/errorHandler';
import { securityHeaders, requestLogger } from './middleware/security';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Standard: Hide Express framework fingerprinting
app.disable('x-powered-by');

// Security Standard: Enterprise HTTP Security Headers (OWASP)
app.use(securityHeaders);

// Operational Standard: Structured Request Logging
app.use(requestLogger);

// CORS Standard: Configurable origin with credentials support for cloud and local environments
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// DoS Defense: Enforce strict payload body limits (OWASP API4)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Resilient Health Check: Validates live database connectivity & response latency
app.get('/api/health', async (req, res) => {
  const start = Date.now();
  try {
    // Ping database with a lightweight scalar query
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - start;

    res.json({
      status: 'healthy',
      database: 'connected',
      dbLatencyMs: dbLatency,
      system: 'Integrated E-Ticketing and Event Management Platform',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', adminRoutes);

// Production Static Assets: Serve pre-built client SPA when available
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error Handler
app.use(errorHandler);

// Start standalone HTTP server outside Vercel serverless runtime
if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`[E-Ticketing API Server] Running on http://localhost:${PORT}`);
  });

  // Operational Standard: Graceful Shutdown Protocol
  const handleGracefulShutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log('[Server] Closed active HTTP connections.');
      try {
        await prisma.$disconnect();
        console.log('[Database] Disconnected Prisma client cleanly.');
      } catch (err) {
        console.error('[Database] Error during disconnect:', err);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
}

export default app;
