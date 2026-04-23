# Bulk Fee Voucher Generation System

## Overview
Complete system for generating fee vouchers in bulk with support for concession calculations and detailed notes.

## Key Features

### 1. **Three Generation Modes**
- **Single Student**: Generate voucher for one specific student
- **By Class**: Generate vouchers for all students in a class
- **Entire Institute**: Generate vouchers for all active students

### 2. **Concession Support**
- **Fixed Concession**: Applies fixed PKR amount discount
- **Percentage Concession**: Applies percentage-based discount
- Concession details (type, amount, reason) stored in voucher notes

### 3. **Automatic Calculations**
```
Amount = Monthly Fee
Discount = Concession (fixed or percentage)
Net Amount = Amount - Discount
```

### 4. **Detailed Notes**
Each voucher includes:
- Student name and registration number
- Monthly fee amount
- Concession type and calculation
- Concession reason
- Net amount to collect

## Data Flow

### Student Details (Backend User Model)
```json
{
  "details": {
    "studentDetails": {
      "monthly_fee": 5000,
      "admission_fee": 2000,
      "annual_charges": 1000,
      "lab_charges": 500,
      "discount_type": "percentage", // or "fixed"
      "concession_percentage": 10,
      "concession_amount": 500,
      "concession_reason": "Scholarship",
      "concession_type": "scholarship"
    }
  }
}
```

### Generated Voucher Structure
```json
{
  "voucher_number": "TCA-202604-0012",
  "amount": 5000.00,
  "discount": 500.00, // calculated based on discount_type
  "net_amount": 4500.00,
  "currency": "PKR",
  "status": "pending",
  "notes": "Student: John Doe (STU001)\nMonthly Fee: PKR 5000.00\nConcession Type: percentage\nConcession: 10% = PKR 500.00\nReason: Scholarship\nNet Amount: PKR 4500.00",
  "fee_breakdown": {
    "monthly_fee": 5000,
    "admission_fee": 2000,
    "annual_charges": 1000,
    "lab_charges": 500,
    "concession_type": "scholarship",
    "discount_type": "percentage",
    "concession_percentage": 10,
    "concession_reason": "Scholarship",
    "student_name": "John Doe",
    "registration_no": "STU001",
    "class_id": "class-123",
    "section_id": "sec-456"
  }
}
```

## API Endpoints

### 1. Generate Single Student Voucher
```bash
POST /api/fee-vouchers/generate-single
Content-Type: application/json

{
  "studentId": "uuid",
  "month": 4,
  "year": 2026
}
```

Response:
```json
{
  "success": true,
  "message": "Voucher generated successfully",
  "data": { ...voucher }
}
```

### 2. Generate Class Vouchers
```bash
POST /api/fee-vouchers/generate-class
Content-Type: application/json

{
  "classId": "uuid",
  "month": 4,
  "year": 2026
}
```

Response:
```json
{
  "success": true,
  "message": "Vouchers generated for class",
  "data": {
    "total": 45,
    "generated": 43,
    "failed": 2,
    "vouchers": [...]
  }
}
```

### 3. Generate Institute Vouchers
```bash
POST /api/fee-vouchers/generate-institute
Content-Type: application/json

{
  "month": 4,
  "year": 2026
}
```

Response:
```json
{
  "success": true,
  "message": "Vouchers generated for institute",
  "data": {
    "total": 250,
    "generated": 245,
    "failed": 5,
    "failedDetails": [
      {
        "studentId": "uuid",
        "studentName": "Jane Smith",
        "error": "Student has no monthly fee configured"
      }
    ],
    "vouchers": [...]
  }
}
```

### 4. Get Vouchers
```bash
GET /api/fee-vouchers?month=4&year=2026&status=pending&page=1&limit=20
```

### 5. Delete/Archive Voucher
```bash
DELETE /api/fee-vouchers/:voucherId
```

## Frontend Component

### BulkVoucherGenerator Component
Located at: `Frontend/src/components/forms/BulkVoucherGenerator.jsx`

**Usage:**
```jsx
import BulkVoucherGenerator from '@/components/forms/BulkVoucherGenerator';

<BulkVoucherGenerator 
  instituteId={instituteId}
  onSuccess={() => console.log('Generated')}
/>
```

**Features:**
- Three tabbed modes (Single, Class, Institute)
- Month/Year selection with dropdown
- Confirmation dialog before generation
- Real-time loading states
- Success/Error notifications

## Backend Service Functions

### `generateSingleVoucher(studentId, instituteId, month, year, createdBy, options)`
Generates a voucher for a single student with concession calculations.

### `generateVouchersForClass(classId, instituteId, month, year, createdBy, options)`
Generates vouchers for all students in a class, with error handling.

### `generateVouchersForInstitute(instituteId, month, year, createdBy, options)`
Generates vouchers for all active students in an institute, returns summary stats.

## Key Calculations

### Concession Calculation
```javascript
if (discountType === 'percentage') {
  discount = (monthlyFee * concessionPercentage) / 100;
} else if (discountType === 'fixed') {
  discount = concessionAmount;
}
netAmount = monthlyFee - discount;
```

## Database Schema

### FeeVoucher Table
```sql
- id (UUID, PK)
- institute_id (UUID, FK)
- student_id (UUID, FK to users)
- voucher_number (STRING, UNIQUE)
- amount (DECIMAL 10,2)
- discount (DECIMAL 10,2)
- net_amount (DECIMAL 10,2)
- month (INTEGER)
- year (INTEGER)
- issued_date (DATE)
- currency (STRING, default: PKR)
- status (ENUM: pending, paid, overdue, cancelled, partial)
- notes (TEXT) - Concession details here
- fee_breakdown (JSONB) - Full component breakdown
- archived (BOOLEAN, default: false)
- created_by (UUID)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## Notes Storage Format

```
Student: John Doe (STU001)
Monthly Fee: PKR 5000.00
Concession Type: percentage
Concession: 10% = PKR 500.00
Reason: Scholarship
Net Amount: PKR 4500.00
```

## Error Handling

1. **No Students**: Returns 404 with message
2. **No Monthly Fee**: Skips student or returns error depending on mode
3. **Duplicate Vouchers**: Prevents duplicate vouchers for same month/year
4. **Paid Vouchers**: Cannot delete paid vouchers

## Integration Points

### Frontend
- StudentForm sends: `annual_charges`, `lab_charges`, `discount_type` to backend
- BulkVoucherGenerator component for generating vouchers
- Fee collection list shows vouchers with concession details

### Backend
- `student.service.js`: Stores concession data in `details.studentDetails`
- `feeVoucher.service.js`: Calculates and generates vouchers
- `feeVoucher.controller.js`: Handles API requests
- `FeeVoucher.model.js`: Schema with JSONB fee_breakdown

## Audit Trail
- Each voucher tracks `created_by` (user who generated it)
- Uses `created_at` and `updated_at` timestamps
- Supports soft delete via `archived` flag

## Future Enhancements
- Scheduled voucher generation (recurring monthly)
- Email notifications when vouchers generated
- Payment gateway integration
- SMS reminder system
- Bulk import/export vouchers
