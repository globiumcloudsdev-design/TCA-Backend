// /**
//  * The Clouds Academy — Institute Controller (Master Admin)
//  */

// import catchAsync from '../../utils/lib/catchAsync.js';
// import { sendSuccess, sendCreated, sendNoContent } from '../../utils/helpers/response.helper.js';
// import * as instituteService from '../../services/institute.service.js';

// // GET /master-admin/institutes
// export const getInstitutes = catchAsync(async (req, res) => {
//   const result = await instituteService.getAllInstitutes(req.query);
//   res.json({ success: true, message: 'Institutes fetched', data: result });
// });

// // GET /master-admin/institutes/:id
// export const getInstituteById = catchAsync(async (req, res) => {
//   const inst = await instituteService.getInstituteById(req.params.id);
//   sendSuccess(res, inst, 'Institute fetched');
// });

// // POST /master-admin/institutes
// export const createInstitute = catchAsync(async (req, res) => {
//   const inst = await instituteService.createInstitute(req.body, req.user.id, req.file ?? null);
//   sendCreated(res, inst, 'Institute created successfully');
// });

// // PUT /master-admin/institutes/:id
// export const updateInstitute = catchAsync(async (req, res) => {
//   const inst = await instituteService.updateInstitute(req.params.id, req.body, req.file ?? null);
//   sendSuccess(res, inst, 'Institute updated successfully');
// });

// // DELETE /master-admin/institutes/:id
// export const deleteInstitute = catchAsync(async (req, res) => {
//   await instituteService.deleteInstitute(req.params.id);
//   sendNoContent(res);
// });

// // PATCH /master-admin/institutes/:id/status
// export const toggleStatus = catchAsync(async (req, res) => {
//   const inst = await instituteService.toggleInstituteStatus(req.params.id, req.body.is_active);
//   sendSuccess(res, inst, 'Status updated');
// });

// // PATCH /master-admin/institutes/:id/subscription-status
// export const updateSubscriptionStatus = catchAsync(async (req, res) => {
//   const inst = await instituteService.updateSubscriptionStatus(req.params.id, req.body.subscription_status);
//   sendSuccess(res, inst, 'Subscription status updated');
// });

/**
 * The Clouds Academy — Institute Controller (Master Admin)
 * Updated with invoice summary and subscription tracking
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/helpers/response.helper.js';
import * as instituteService from '../../services/institute.service.js';
import { getInvoiceSummary } from '../../utils/subscriptionUtils.js';

// GET /master-admin/institutes
export const getInstitutes = catchAsync(async (req, res) => {
  const result = await instituteService.getAllInstitutes(req.query);
  
  // Add invoice summary for each institute (optional, can be heavy for large lists)
  if (req.query.include_invoice_summary === 'true') {
    for (const institute of result.rows) {
      institute.dataValues.invoice_summary = await getInvoiceSummary(institute.id);
    }
  }
  
  res.json({ 
    success: true, 
    message: 'Institutes fetched', 
    data: result 
  });
});

// GET /master-admin/institutes/:id
export const getInstituteById = catchAsync(async (req, res) => {
  const inst = await instituteService.getInstituteById(req.params.id);
  
  // Get invoice summary for single institute
  const invoiceSummary = await getInvoiceSummary(req.params.id);
  
  // Get subscription status details
  const subscriptionDetails = await instituteService.getSubscriptionDetails(req.params.id);
  
  sendSuccess(res, {
    ...inst.toJSON(),
    invoice_summary: invoiceSummary,
    subscription_details: subscriptionDetails
  }, 'Institute fetched');
});

// POST /master-admin/institutes
export const createInstitute = catchAsync(async (req, res) => {
  const inst = await instituteService.createInstitute(
    req.body, 
    req.user.id, 
    req.file ?? null
  );
  
  sendCreated(res, {
    ...inst.toJSON(),
    message: inst.subscription_status === 'trial' 
      ? 'Institute created with trial period' 
      : 'Institute created with active subscription'
  }, 'Institute created successfully');
});

// PUT /master-admin/institutes/:id
export const updateInstitute = catchAsync(async (req, res) => {
  const inst = await instituteService.updateInstitute(
    req.params.id, 
    req.body, 
    req.file ?? null
  );
  sendSuccess(res, inst, 'Institute updated successfully');
});

// DELETE /master-admin/institutes/:id
export const deleteInstitute = catchAsync(async (req, res) => {
  await instituteService.deleteInstitute(req.params.id);
  sendNoContent(res);
});

// PATCH /master-admin/institutes/:id/status
export const toggleStatus = catchAsync(async (req, res) => {
  const inst = await instituteService.toggleInstituteStatus(
    req.params.id, 
    req.body.is_active
  );
  sendSuccess(res, inst, 'Status updated');
});

// PATCH /master-admin/institutes/:id/subscription-status
export const updateSubscriptionStatus = catchAsync(async (req, res) => {
  const inst = await instituteService.updateSubscriptionStatus(
    req.params.id, 
    req.body.subscription_status
  );
  sendSuccess(res, inst, 'Subscription status updated');
});

// NEW: PATCH /master-admin/institutes/:id/plan
export const updateInstitutePlan = catchAsync(async (req, res) => {
  const { planId, effectiveDate } = req.body;
  const inst = await instituteService.updateInstitutePlan(
    req.params.id, 
    planId, 
    effectiveDate ? new Date(effectiveDate) : new Date()
  );
  sendSuccess(res, inst, 'Subscription plan updated successfully. New invoice generated.');
});

// NEW: GET /master-admin/institutes/:id/invoices
export const getInstituteInvoices = catchAsync(async (req, res) => {
  const invoices = await instituteService.getInstituteInvoices(
    req.params.id, 
    req.query
  );
  sendSuccess(res, invoices, 'Invoices fetched successfully');
});

// NEW: POST /master-admin/invoices/:id/mark-paid
export const markInvoicePaid = catchAsync(async (req, res) => {
  const { payment_method, payment_reference, notes } = req.body;
  const invoice = await instituteService.markInvoicePaid(
    req.params.id,
    {
      payment_method,
      payment_reference,
      notes,
      paid_by: req.user.id
    }
  );
  sendSuccess(res, invoice, 'Invoice marked as paid');
});

// NEW: GET /master-admin/institutes/:id/subscription/history
export const getSubscriptionHistory = catchAsync(async (req, res) => {
  const history = await instituteService.getSubscriptionHistory(req.params.id);
  sendSuccess(res, history, 'Subscription history fetched');
});

// NEW: GET /master-admin/invoices  — all invoices across all institutes
export const getAllInvoices = catchAsync(async (req, res) => {
  const result = await instituteService.getAllInvoices(req.query);
  sendSuccess(res, result, 'All invoices fetched successfully');
});