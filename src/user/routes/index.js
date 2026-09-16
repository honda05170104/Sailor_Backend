import express from 'express';
import lineRoutes from './line.js';
import userRoutes from './user.js';

const router = express.Router();

router.use(lineRoutes);
router.use(userRoutes);

export default router;
