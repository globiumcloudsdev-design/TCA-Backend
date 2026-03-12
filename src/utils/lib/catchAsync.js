/**
 * The Clouds Academy - Async Error Wrapper
 * Eliminates try-catch blocks in controllers
 */

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default catchAsync;
