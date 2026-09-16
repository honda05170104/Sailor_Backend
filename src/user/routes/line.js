import express from 'express';
import auth from '../../middleware/auth.js';
import * as userController from '../controllers/user.controller.js';

const router = express.Router();

router.post('/lineLogin', userController.line);
router.get('/getUser', auth, userController.get);
router.get('/getTransaction', auth, userController.getTransactions);
router.get('/getVip', auth, userController.getVips);
router.get('/getCoupon', auth, userController.getCoupons);
router.post('/updateUser', auth, userController.update);
router.post('/updateTag', auth, userController.updateTags);
router.post('/logout', auth, userController.logout);

export default router;
