#!/usr/bin/env node

/**
 * PAYROLL FIX SCRIPT
 * 
 * This script identifies and fixes payslips with incorrect net_salary values.
 * Run: node scripts/fix-payroll-net-salary.js
 */

import sequelize from '../src/config/database.js';
import logger from '../src/config/logger.js';
import Payslip from '../src/models/postgres/Payslip.model.js';
import Policy from '../src/models/postgres/Policy.model.js';
import User from '../src/models/postgres/User.model.js';
import { Op } from 'sequelize';

async function fixPayrollNetSalaries() {
  try {
    console.log('\n🔧 PAYROLL NET SALARY FIX SCRIPT\n');

    // Get all payslips with suspicious net_salary values
    const allPayslips = await Payslip.findAll({
      include: [
        { model: User, as: 'staff', attributes: ['id', 'first_name', 'last_name', 'details'] },
        { model: User, as: 'generator', attributes: ['id', 'first_name', 'last_name'] },
      ],
      order: [['created_at', 'DESC']],
    });

    console.log(`📊 Found ${allPayslips.length} payslips to check\n`);

    let fixedCount = 0;
    let issuesFound = 0;

    for (const payslip of allPayslips) {
      const basicSalary = Number(payslip.basic_salary) || 0;
      const netSalary = Number(payslip.net_salary) || 0;
      const totalAllowances = Number(payslip.total_allowances) || 0;
      const totalDeductions = Number(payslip.total_deductions) || 0;

      // Sanity check: net_salary should equal basic + allowances - deductions
      const expectedNet = basicSalary + totalAllowances - totalDeductions;
      const difference = Math.abs(netSalary - expectedNet);

      // If there's more than 0.01 difference, it's wrong
      if (difference > 0.01) {
        issuesFound++;
        console.log(`⚠️  ISSUE FOUND:`);
        console.log(`   Employee: ${payslip.staff?.first_name} ${payslip.staff?.last_name}`);
        console.log(`   Period: ${payslip.month}/${payslip.year}`);
        console.log(`   Current Net: ${netSalary}`);
        console.log(`   Expected Net: ${expectedNet}`);
        console.log(`   Basic: ${basicSalary}, Allowances: ${totalAllowances}, Deductions: ${totalDeductions}`);

        // Update to correct value
        await payslip.update({ net_salary: Math.round(expectedNet * 100) / 100 });
        fixedCount++;
        console.log(`   ✓ FIXED to ${expectedNet}\n`);
      }

      // Also check for 100x multiplier pattern
      if (netSalary > basicSalary * 10) {
        console.log(`⚠️  WARNING: Net salary is ${netSalary} (${(netSalary / basicSalary).toFixed(0)}x basic of ${basicSalary})`);
        console.log(`   This may indicate a policy configuration error with high allowance percentages.\n`);
      }
    }

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total payslips: ${allPayslips.length}`);
    console.log(`   Issues found: ${issuesFound}`);
    console.log(`   Fixed: ${fixedCount}`);

    if (issuesFound === 0) {
      console.log(`\n✅ All payslips look correct!\n`);
    }

  } catch (error) {
    console.error('❌ Error during fix:', error.message);
    logger.error('Payroll fix script error:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the script
fixPayrollNetSalaries().then(() => {
  console.log('✓ All done!\n');
  process.exit(0);
}).catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
