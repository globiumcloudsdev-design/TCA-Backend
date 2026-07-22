import { Router } from 'express';
import { supportController } from '../../controllers/support.controller.js';
import { protect, restrictTo } from '../../middlewares/auth.middleware.js';

const router = Router();

// Allow Institute admins and authorized roles to access support
router.use(protect, restrictTo('BRANCH_ADMIN', 'INSTITUTE_ADMIN'));

router.post('/', supportController.createTicket);
router.get('/', supportController.getMyTickets);
router.get('/:id', supportController.getTicketDetails);
router.post('/:id/reply', supportController.addReply);

export default router;
