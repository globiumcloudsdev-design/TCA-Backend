import { getSystemHealth } from '../../services/systemHealth.service.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';

export const getHealthStats = async (req, res, next) => {
  try {
    const health = await getSystemHealth();
    return sendSuccess(res, health, 'System health retrieved successfully');
  } catch (error) {
    next(error);
  }
};
