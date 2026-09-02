/**
 * The Clouds Academy — Leave Types Seeder
 *
 * Seeds common leave types for institutes.
 * Since LeaveType requires institute_id, we create these for any existing institute,
 * or provide this as a reusable function for new institutes.
 *
 * Run:  node src/seeders/index.seed.js
 */

const DEFAULT_LEAVE_TYPES = [
  {
    leave_type_name: 'Casual Leave',
    description: 'Leave taken for personal work or urgent matters',
    max_days_per_year: 10,
    requires_approval: true,
    is_paid: true,
    color_code: '#3B82F6',
    is_active: true,
    display_order: 1,
  },
  {
    leave_type_name: 'Sick Leave',
    description: 'Leave taken for medical reasons or health issues',
    max_days_per_year: 12,
    requires_approval: true,
    is_paid: true,
    color_code: '#EF4444',
    is_active: true,
    display_order: 2,
  },
  {
    leave_type_name: 'Earned Leave',
    description: 'Annual vacation leave earned during employment',
    max_days_per_year: 21,
    requires_approval: true,
    is_paid: true,
    color_code: '#10B981',
    is_active: true,
    display_order: 3,
  },
  {
    leave_type_name: 'Medical Leave',
    description: 'Extended leave for serious medical conditions',
    max_days_per_year: 30,
    requires_approval: true,
    is_paid: true,
    color_code: '#F59E0B',
    is_active: true,
    display_order: 4,
  },
  {
    leave_type_name: 'Maternity Leave',
    description: 'Leave for pregnant women and new mothers',
    max_days_per_year: 180,
    requires_approval: false,
    is_paid: true,
    color_code: '#EC4899',
    is_active: true,
    display_order: 5,
  },
  {
    leave_type_name: 'Paternity Leave',
    description: 'Leave for new fathers',
    max_days_per_year: 10,
    requires_approval: false,
    is_paid: true,
    color_code: '#8B5CF6',
    is_active: true,
    display_order: 6,
  },
  {
    leave_type_name: 'Compassionate Leave',
    description: 'Leave due to death or serious illness in family',
    max_days_per_year: 5,
    requires_approval: true,
    is_paid: true,
    color_code: '#6B7280',
    is_active: true,
    display_order: 7,
  },
  {
    leave_type_name: 'Study Leave',
    description: 'Leave for educational purposes and exams',
    max_days_per_year: 5,
    requires_approval: true,
    is_paid: false,
    color_code: '#06B6D4',
    is_active: true,
    display_order: 8,
  },
  {
    leave_type_name: 'Leave Without Pay',
    description: 'Unpaid leave for personal or other reasons',
    max_days_per_year: 0,
    requires_approval: true,
    is_paid: false,
    color_code: '#9CA3AF',
    is_active: true,
    display_order: 9,
  },
  {
    leave_type_name: 'Holiday',
    description: 'National or institutional holiday',
    max_days_per_year: 0,
    requires_approval: false,
    is_paid: true,
    color_code: '#FBBF24',
    is_active: true,
    display_order: 10,
  },
];

export const seedLeaveTypes = async (models, instituteId) => {
  const { LeaveType, Institute } = models;

  if (!instituteId) {
    console.log('⚠️  No instituteId provided — skipping LeaveType seeding');
    console.log('    Call seedLeaveTypes(models, instituteId) with a valid institute ID');
    return;
  }

  // Verify institute exists
  const institute = await Institute.findByPk(instituteId);
  if (!institute) {
    console.log(`⚠️  Institute with ID ${instituteId} not found — skipping LeaveType seeding`);
    return;
  }

  console.log(`\n📚 Seeding Leave Types for: ${institute.name}`);
  console.log('─'.repeat(55));

  let created = 0;
  let skipped = 0;

  for (const leaveType of DEFAULT_LEAVE_TYPES) {
    let record = await LeaveType.findOne({
      where: {
        institute_id: instituteId,
        leave_type_name: leaveType.leave_type_name,
      },
      paranoid: false,
    });

    if (record) {
      if (record.deleted_at) {
        await record.restore();
      }
      await record.update(leaveType);
      skipped++;
    } else {
      await LeaveType.create({
        institute_id: instituteId,
        ...leaveType,
      });
      console.log(`  ✅ ${leaveType.leave_type_name}`);
      created++;
    }
  }

  console.log('─'.repeat(55));
  console.log(`  Created: ${created} | Skipped: ${skipped}`);
};

/**
 * Utility function to seed leave types for a new institute
 * Can be called from institute creation service
 */
export const initializeLeaveTypesForInstitute = async (models, instituteId) => {
  return seedLeaveTypes(models, instituteId);
};
