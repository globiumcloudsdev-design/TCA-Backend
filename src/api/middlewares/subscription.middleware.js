/**
 * The Clouds Academy - Subscription Middleware
 *
 * Checks if school has active subscription before allowing access.
 */

import { AppError } from '../../utils/lib/AppError.js';
import catchAsync from '../../utils/lib/catchAsync.js';

export const requireActiveSubscription = catchAsync(async (req, res, next) => {
  // Master Admin — bypass
  if (req.user?.user_type === 'MASTER_ADMIN') return next();

  const school = req.school;
  if (!school) throw new AppError('School context missing.', 500);

  if (!school.subscription_status || school.subscription_status === 'expired') {
    throw new AppError(
      'School subscription has expired. Please renew to continue.',
      402
    );
  }

  if (school.subscription_status === 'suspended') {
    throw new AppError(
      'School account has been suspended. Contact support.',
      403
    );
  }

  next();
});

// Alias for routes that import under the old name
export const checkSubscription = requireActiveSubscription;

export default requireActiveSubscription;

