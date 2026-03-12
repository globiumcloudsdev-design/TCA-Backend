/**
 * The Clouds Academy - Stripe Payment Config
 */

import Stripe from 'stripe';
import config from './index.js';

const stripe = new Stripe(config.payment.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

export { stripe };
export default stripe;
