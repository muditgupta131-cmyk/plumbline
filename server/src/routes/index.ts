import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import marketRoutes from '../modules/market/market.routes.js';
import aiRoutes from '../modules/ai/ai.routes.js';
import portfolioRoutes from '../modules/portfolio/portfolio.routes.js';
import brokerRoutes from '../modules/broker/broker.routes.js';
import fundRoutes from '../modules/funds/fund.routes.js';
import newsRoutes from '../modules/news/news.routes.js';
import ipoRoutes from '../modules/ipo/ipo.routes.js';
import bondRoutes from '../modules/bonds/bond.routes.js';
import screenerRoutes from '../modules/screener/screener.routes.js';
import watchlistRoutes from '../modules/watchlist/watchlist.routes.js';
import notificationRoutes from '../modules/watchlist/notification.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/market', marketRoutes);
router.use('/ai', aiRoutes);
router.use('/portfolio', portfolioRoutes);
router.use('/brokers', brokerRoutes);
router.use('/funds', fundRoutes);
router.use('/news', newsRoutes);
router.use('/ipo', ipoRoutes);
router.use('/bonds', bondRoutes);
router.use('/screener', screenerRoutes);
router.use('/watchlist', watchlistRoutes);
router.use('/notifications', notificationRoutes);

export default router;
