import type { Role } from '../modules/auth/user.model.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: Role;
        sessionId: string;
      };
    }
  }
}

export {};
