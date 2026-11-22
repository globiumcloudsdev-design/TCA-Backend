/**
 * Async error safety net (Express 4).
 *
 * Express 4 does not catch rejected promises returned by async route handlers,
 * so a single thrown error in an un-wrapped controller used to become an
 * unhandledRejection (and previously crashed the process). This patches the
 * router Layer once so every handler's returned promise is forwarded to
 * next(err) -> the central error handler.
 *
 * Must be imported before any routes are registered.
 */
import Layer from 'express/lib/router/layer.js';

if (!Layer.prototype.__asyncPatched) {
  Layer.prototype.handle_request = function handleRequest(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next(); // error-handling middleware: not for normal requests
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
  Layer.prototype.__asyncPatched = true;
}
