import { Router } from 'express';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { requireAuth } from '../../middleware/authenticate.js';
import { requireDatabase } from '../../middleware/requireDatabase.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import {
  changePasswordSchema,
  googleSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from './auth.schema.js';

const router = Router();

router.use(requireDatabase);

router.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post('/google', authLimiter, validate({ body: googleSchema }), controller.google);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);

router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, validate({ body: updateProfileSchema }), controller.updateMe);
router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  validate({ body: changePasswordSchema }),
  controller.changePassword,
);

export default router;
