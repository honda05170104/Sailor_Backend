import express from 'express';
import auth from '../../middleware/auth.js';
import * as userController from '../controllers/user.controller.js';

const router = express.Router();

router.post('/dev', userController.dev);
router.get('/', auth, userController.get);
router.get('/animal', auth, userController.getAnimals);
router.post('/animal', auth, userController.updateAnimals);
router.get('/mice', auth, userController.getMice);
router.post('/mice', auth, userController.updateMice);
router.post('/profile', auth, userController.update);
router.post('/avatar/line', auth, userController.syncLineAvatar);

export default router;
