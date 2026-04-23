import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { hasPermission } from '../../middlewares/permission.middleware.js';
import * as payrollController from '../../controllers/payroll.controller.js';

const router = Router();
router.use(protect);

// Generate bulk payroll
router.post('/generate', hasPermission('payroll.process'), payrollController.generatePayroll);

// CRUD for payslips
router.route('/')
    .get(hasPermission('payroll.read'), payrollController.getAllPayslips);
router.get('/years', hasPermission('payroll.read'), payrollController.getPayrollYears);

router.route('/:id')
    .get(hasPermission('payroll.read'), payrollController.getPayslipById)
    .patch(hasPermission('payroll.create'), payrollController.updatePayslip)
    .delete(hasPermission('payroll.create'), payrollController.deletePayslip);

export default router;