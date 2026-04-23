# Leave Types Seeding Guide

## Overview

The Leave Types seeding system provides comprehensive leave type templates for institutes. Every institute should have these default leave types configured for their attendance tracking system.

## Leave Types Included

1. **Casual Leave** - 10 days/year - Personal work or urgent matters
2. **Sick Leave** - 12 days/year - Medical reasons or health issues
3. **Earned Leave** - 21 days/year - Annual vacation leave
4. **Medical Leave** - 30 days/year - Extended medical conditions
5. **Maternity Leave** - 180 days/year - For pregnant women and new mothers
6. **Paternity Leave** - 10 days/year - For new fathers
7. **Compassionate Leave** - 5 days/year - Family death or serious illness
8. **Study Leave** - 5 days/year - Educational purposes (unpaid)
9. **Leave Without Pay** - Unlimited - Unpaid personal leave
10. **Holiday** - National/institutional holidays (unlimited, no approval needed)

## Color Coding

Each leave type has a unique color for UI differentiation:
- **Casual Leave**: Blue (#3B82F6)
- **Sick Leave**: Red (#EF4444)
- **Earned Leave**: Green (#10B981)
- **Medical Leave**: Amber (#F59E0B)
- **Maternity Leave**: Pink (#EC4899)
- **Paternity Leave**: Purple (#8B5CF6)
- **Compassionate Leave**: Gray (#6B7280)
- **Study Leave**: Cyan (#06B6D4)
- **Leave Without Pay**: Light Gray (#9CA3AF)
- **Holiday**: Yellow (#FBBF24)

## Seeding Methods

### Method 1: Initial Database Setup

When running the main seeder:

```bash
npm run seed
```

This will automatically seed leave types for the first institute in the database (if one exists).

### Method 2: For New Institutes

When creating a new institute, automatically initialize leave types:

```javascript
import { initializeLeaveTypesForInstitute } from '../utils/lib/leaveTypeInitializer.js';

// After creating an institute
const institute = await Institute.create({ ... });
await initializeLeaveTypesForInstitute(institute.id);
```

### Method 3: Manual Seeding for Specific Institute

```javascript
import { seedLeaveTypes } from '../seeders/04.leaveTypes.seed.js';
import models from '../models/postgres/index.js';

// Seed for a specific institute
await seedLeaveTypes(models, 'institute-uuid-here');
```

## Database Fields

### leave_types table

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| institute_id | UUID | Institute this type belongs to (FK) |
| leave_type_name | STRING | Name of the leave type |
| description | TEXT | Detailed description |
| max_days_per_year | INTEGER | Maximum days allowed per year (0 = unlimited) |
| requires_approval | BOOLEAN | Whether approval is needed before marking |
| is_paid | BOOLEAN | Whether this is paid or unpaid leave |
| color_code | STRING(7) | Hex color for UI (#RRGGBB) |
| is_active | BOOLEAN | Whether this leave type is currently active |
| display_order | INTEGER | Display order in UI (lower = higher priority) |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Update timestamp |
| deleted_at | DATETIME | Soft delete timestamp |

## Integration Points

### StaffAttendance Model
- **leave_type_id**: Reference to mark staff as on leave
- **leave_request_id**: Link to the approval workflow

### StudentAttendance Model
- **leave_type_id**: Reference to mark student as on leave
- **leave_request_id**: Link to the approval workflow

### LeaveRequest Model
- Links leave applications to leave types
- Supports approval workflow (PENDING → APPROVED/REJECTED)
- Works for both STAFF and STUDENT user types

## Customization

To add more leave types or modify existing ones, edit the `DEFAULT_LEAVE_TYPES` array in:
```
/src/seeders/04.leaveTypes.seed.js
```

Example:
```javascript
{
  leave_type_name: 'Bereavement Leave',
  description: 'Leave due to death of a close relative',
  max_days_per_year: 3,
  requires_approval: false,
  is_paid: true,
  color_code: '#1F2937',
  is_active: true,
  display_order: 11,
}
```

## Notes

- Leave types are institute-specific (each institute can have different configurations)
- Leave type initialization is non-destructive (won't overwrite existing)
- If an institute already has a leave type with the same name, it won't be duplicated
- Soft deletes are supported (is_active = false instead of hard delete)
- All leave types include timestamps for audit purposes

---

**Location**: Backend/src/seeders/04.leaveTypes.seed.js
**Utility**: Backend/src/utils/lib/leaveTypeInitializer.js
