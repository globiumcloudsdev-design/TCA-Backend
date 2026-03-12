/**
 * The Clouds Academy - Standard Response Helper
 */

export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data, timestamp: new Date().toISOString() });

export const sendCreated = (res, data, message = 'Created successfully') =>
  res.status(201).json({ success: true, message, data, timestamp: new Date().toISOString() });

export const sendPaginated = (res, data, pagination, message = 'Success') =>
  res.status(200).json({ success: true, message, data, pagination, timestamp: new Date().toISOString() });

export const sendNoContent = (res) => res.status(204).send();

export const sendError = (res, message = 'Error', statusCode = 500, errors = null) => {
  const payload = { success: false, message, timestamp: new Date().toISOString() };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

export const sendBadRequest = (res, message = 'Bad request', errors = null) =>
  sendError(res, message, 400, errors);

export const sendUnauthorized = (res, message = 'Unauthorized') =>
  sendError(res, message, 401);

export const sendForbidden = (res, message = 'Access forbidden') =>
  sendError(res, message, 403);

export const sendNotFound = (res, message = 'Not found') =>
  sendError(res, message, 404);

export const sendConflict = (res, message = 'Already exists') =>
  sendError(res, message, 409);

export const sendValidationError = (res, errors, message = 'Validation failed') =>
  sendError(res, message, 422, errors);

export default {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendNoContent,
  sendError,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError,
};
