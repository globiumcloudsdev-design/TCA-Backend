/**
 * The Clouds Academy — Subscription Plans Seeder
 *
 * Seeds the 4 subscription plans (Basic, Standard, Premium, Enterprise).
 * Each plan has a `default_role_code` pointing to the pre-seeded template role,
 * so when a school subscribes the correct permissions are auto-assigned.
 */

const SUBSCRIPTION_PLANS = [
  {
    name: 'Basic',
    code: 'BASIC',
    price_monthly: 2999.00,
    price_yearly: 29990.00,
    currency: 'PKR',
    max_students: 200,
    max_teachers: 20,
    max_users: 10,
    trial_days: 30,
    default_role_code: 'SCHOOL_BASIC',
    description: 'Perfect for small schools — core student, attendance, and fee management.',
    features: {
      students: true,
      teachers: true,
      parents: true,
      classes: true,
      attendance: true,
      exams: true,
      fees: true,
      notices: true,
      reports: 'basic',
      payroll: false,
      analytics: false,
      branches: false,
      library: false,
      admissions: 'basic',
      apiAccess: false,
      prioritySupport: false,
    },
  },
  {
    name: 'Standard',
    code: 'STANDARD',
    price_monthly: 5999.00,
    price_yearly: 59990.00,
    currency: 'PKR',
    max_students: 500,
    max_teachers: 50,
    max_users: 25,
    trial_days: 30,
    default_role_code: 'SCHOOL_STANDARD',
    description: 'Ideal for growing schools — payroll, staff management, and advanced reports.',
    features: {
      students: true,
      teachers: true,
      parents: true,
      staff: true,
      classes: true,
      attendance: true,
      exams: true,
      fees: true,
      notices: true,
      reports: 'advanced',
      payroll: true,
      analytics: true,
      branches: false,
      library: false,
      admissions: 'full',
      apiAccess: false,
      prioritySupport: false,
    },
  },
  {
    name: 'Premium',
    code: 'PREMIUM',
    price_monthly: 9999.00,
    price_yearly: 99990.00,
    currency: 'PKR',
    max_students: 1000,
    max_teachers: 100,
    max_users: 50,
    trial_days: 30,
    default_role_code: 'SCHOOL_PREMIUM',
    description: 'Full-featured for established schools — branches, library, full analytics.',
    features: {
      students: true,
      teachers: true,
      parents: true,
      staff: true,
      classes: true,
      attendance: true,
      exams: true,
      fees: true,
      notices: true,
      reports: 'full',
      payroll: true,
      analytics: true,
      branches: true,
      library: true,
      admissions: 'full',
      apiAccess: false,
      prioritySupport: true,
    },
  },
  {
    name: 'Enterprise',
    code: 'ENTERPRISE',
    price_monthly: 19999.00,
    price_yearly: 199990.00,
    currency: 'PKR',
    max_students: -1,   // -1 = unlimited (enforced in application logic)
    max_teachers: -1,
    max_users: -1,
    trial_days: 30,
    default_role_code: 'SCHOOL_ENTERPRISE',
    description: 'Unlimited scale for large institutions — full access, API & dedicated support.',
    features: {
      students: true,
      teachers: true,
      parents: true,
      staff: true,
      classes: true,
      attendance: true,
      exams: true,
      fees: true,
      notices: true,
      reports: 'full',
      payroll: true,
      analytics: true,
      branches: true,
      library: true,
      admissions: 'full',
      apiAccess: true,
      prioritySupport: true,
      dedicatedManager: true,
      customDomain: true,
    },
  },
];

// ─── Seeder function ───────────────────────────────────────────────────────────
export const seedSubscriptionPlans = async (models) => {
  const { SubscriptionPlan } = models;
  let created = 0;
  let updated = 0;

  for (const plan of SUBSCRIPTION_PLANS) {
    const [record, wasCreated] = await SubscriptionPlan.findOrCreate({
      where: { code: plan.code },
      defaults: plan,
    });

    if (!wasCreated) {
      await record.update(plan);
      updated++;
    } else {
      created++;
    }
  }

  console.log(`✅ Subscription Plans: ${created} created, ${updated} updated (total: ${SUBSCRIPTION_PLANS.length})`);
};
