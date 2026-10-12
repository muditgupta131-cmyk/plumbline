import { Router } from 'express';
import * as controller from './ipo.controller.js';

const router = Router();

// Public: IPO data is market information, not account data.
router.get('/', controller.list);
router.get('/:slug', controller.detail);

export default router;
