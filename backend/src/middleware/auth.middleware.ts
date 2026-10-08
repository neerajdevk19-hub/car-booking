import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';
import { prisma } from '../prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export async function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    // Demo Mode Backdoor to allow seamless UI testing without a login page
    if (token === 'demo-jwt-token' || token === 'demo-jwt-admin' || token === 'demo-jwt-driver') {
      const targetRole = token === 'demo-jwt-admin' ? 'ADMIN' : token === 'demo-jwt-driver' ? 'DRIVER' : 'CUSTOMER';
      const targetEmail = targetRole === 'ADMIN' ? 'admin@rideai.com' : 'demo@rideai.com';
      
      // Look up a valid user ID to prevent Foreign Key errors
      const realUser = await prisma.user.findFirst({ where: { role: targetRole } });
      
      req.user = {
        id: realUser?.id || 'demo-user-123',
        email: realUser?.email || targetEmail,
        role: targetRole,
        name: realUser?.name || 'Demo User'
      };
      
      // Also bypass the demo user check in requireRole by setting a special flag
      (req as any).isDemoUser = true;
      return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
      if (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
      }
      req.user = decoded;
      next();
    });
  } else {
    res.status(401).json({ success: false, message: 'Authorization header missing' });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ success: false, message: 'Forbidden: User not authenticated' });
    }
    
    // Demo backdoor allows viewing all pages
    if ((req as any).isDemoUser) {
      return next();
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
}
