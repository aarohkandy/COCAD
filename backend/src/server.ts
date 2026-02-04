import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { planRouter } from './routes/plan.js';
import { actionsRouter } from './routes/actions.js';
import { clarifyRouter } from './routes/clarify.js';
import { verifyRouter } from './routes/verify.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - allow Chrome extension (any id) and Onshape
app.use(cors({
  origin: (origin, callback) => {
    // No origin = same-origin or non-browser (e.g. curl)
    if (!origin) return callback(null, true);
    if (
      origin.startsWith('chrome-extension://') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin === 'https://cad.onshape.com'
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes
app.use('/api/plan', planRouter);
app.use('/api/actions', actionsRouter);
app.use('/api/clarify', clarifyRouter);
app.use('/api/verify', verifyRouter);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 COCAD Backend running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️  Warning: GROQ_API_KEY not set. AI features will not work.');
  }
});
