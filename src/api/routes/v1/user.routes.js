import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { uploadSingle } from '../../middlewares/upload.middleware.js';
import { getMyProfile, updateMyProfile } from '../../controllers/user.controller.js';

const router = Router();
router.use(protect);

router.get('/profile', getMyProfile);
router.put('/profile', uploadSingle('avatar'), updateMyProfile);

export default router;