#!/usr/bin/env node

/**
 * PAYROLL POLICY DIAGNOSTIC SCRIPT
 * 
 * This script analyzes payroll policies to identify configuration issues.
 * Run: node scripts/diagnose-payroll-policy.js
 */

import sequelize from '../src/config/database.js';
import logger from '../src/config/logger.js';
import Policy from '../src/models/postgres/Policy.model.js';
import Payslip from '../src/models/postgres/Payslip.model.js';

async function diagnosePayrollPolicy() {
  try {
    console.log('\n🔍 PAYROLL POLICY DIAGNOSTIC SCRIPT\n');

    // Find all active payroll policies
    const policies = await Policy.findAll({
      where: {
        policy_type: 'payroll',
        is_active: true,
      },
    });

    console.log(`📊 Found ${policies.length} active payroll policies\n`);

    for (const policy of policies) {
      const config = policy.config || {};
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 Policy: ${policy.policy_name}`);
      console.log(`   Type: ${policy.policy_type}`);
      console.log(`   Institute: ${policy.institute_id}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Check salary calculation
      if (config.salary_calculation) {
        console.log(`\n💰 Salary Calculation:`);
        console.log(`   Method: ${config.salary_calculation.method}`);

        if (config.salary_calculation.allowances) {
          console.log(`\n   Allowances:`);
          for (const allowance of config.salary_calculation.allowances) {
            const percentage = Number(allowance.percentage) || 0;
            
            // Check for issues
            let status = '✓';
            if (percentage > 1000) {
              status = '⚠️  CRITICAL';
            } else if (percentage > 100) {
              status = '⚠️  WARNING';
            }

            console.log(`     ${status} ${allowance.name}: ${percentage}%`);
          }
        }

        if (config.salary_calculation.fixed_allowances) {
          console.log(`\n   Fixed Allowances:`);
          for (const fa of config.salary_calculation.fixed_allowances) {
            console.log(`     ✓ ${fa.name}: ${fa.amount}`);
          }
        }
      }

      // Check deductions
      if (config.other_deductions) {
        console.log(`\n🔴 Deductions:`);
        for (const ded of config.other_deductions) {
          const percentage = Number(ded.percentage) || 0;
          const amount = Number(ded.amount) || 0;
          
          if (percentage) {
            let status = '✓';
            if (percentage > 100) {
              status = '⚠️  WARNING';
            }
            console.log(`     ${status} ${ded.name}: ${percentage}%`);
          } else if (amount) {
            console.log(`     ✓ ${ded.name}: ${amount}`);
          }
        }
      }

      // Overtime
      if (config.overtime) {
        console.log(`\n⏱️  Overtime:`);
        console.log(`   Enabled: ${config.overtime.enabled}`);
        console.log(`   Rate/hour: ${config.overtime.rate_per_hour}`);
        console.log(`   Multiplier: ${config.overtime.multiplier}`);
      }

      // Check payslips generated with this policy
      const payslips = await Payslip.findAll({
        where: { institute_id: policy.institute_id },
        limit: 5,
        order: [['created_at', 'DESC']],
      });

      if (payslips.length > 0) {
        console.log(`\n📊 Recent Payslips (${payslips.length}):`);
        for (const ps of payslips) {
          const basic = Number(ps.basic_salary) || 0;
          const net = Number(ps.net_salary) || 0;
          const ratio = (net / basic).toFixed(2);
          
          let status = '✓';
          if (ratio > 10) {
            status = '⚠️  HIGH';
          } else if (ratio > 2) {
            status = '⚠️  MEDIUM';
          }
          
          console.log(`   ${status} Basic: ${basic}, Net: ${net} (${ratio}x)`);
        }
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
    logger.error('Payroll diagnosis script error:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the script
diagnosePayrollPolicy().then(() => {
  console.log('✓ Diagnosis complete!\n');
  process.exit(0);
}).catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
