import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { driversRouter } from './modules/drivers/drivers.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { aiAgentRouter } from './ai/agent/ai-agent.routes';

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json());

// API Health Check & Info
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'RideAI API',
    version: '1.0.0',
    demoMode: process.env.DEMO_MODE !== 'false',
    timestamp: new Date()
  });
});

// Mount V1 API Routes
app.use('/api/v1/drivers', driversRouter);
app.use('/api/v1/rides', bookingsRouter);
app.use('/api/v1/agent', aiAgentRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('API Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});
