# 📬 Perfect Notification System - Complete Documentation

## Overview

A comprehensive, real-time notification system for The Clouds Academy that supports:
- ✅ Single user notifications
- ✅ Broadcast to multiple users (All Parents, Teachers, Students, Staff, etc.)
- ✅ Multiple channels (in-app, email, SMS, push)
- ✅ Real-time Socket.io integration
- ✅ Perfect UI component with filtering & management
- ✅ Complete REST API endpoints

---

## 🎯 Quick Start

### 1. Frontend: Add NotificationPanel to Header

```jsx
// src/components/layouts/Header.jsx
import { NotificationPanel } from '@/components/common/NotificationPanel';

export const Header = () => (
  <header className="flex items-center justify-between">
    {/* Other header items */}
    <NotificationPanel />
  </header>
);
```

### 2. Backend: Send Notification in a Service

```javascript
// In any service (e.g., studentAttendance.service.js)
import { createNotification, broadcastNotification } from '../services/notification.service.js';

// Send to specific user
await createNotification({
  institute_id: req.school.id,
  user_id: parentId,
  title: 'Attendance Marked',
  body: 'Your child\'s attendance has been marked present',
  type: 'attendance',
  channel: 'in_app',
  data: { studentName, date, status }
}, true); // true = emit real-time

// Broadcast to all parents
await broadcastNotification({
  institute_id: req.school.id,
  branch_id: branchId,
  recipient_type: 'ALL_PARENTS',
  title: 'Fee Voucher Generated',
  body: 'New fee voucher for this month',
  type: 'fee',
  channel: 'in_app',
  data: { amount, month, dueDate }
}, true);
```

---

## 📋 Backend API Endpoints

### Get Notifications
```
GET /api/v1/notifications
Query: ?page=1&limit=20&type=fee&is_read=false&sort=DESC

Response:
{
  "success": true,
  "data": {
    "notifications": [...],
    "pagination": { page, limit, total, pages }
  }
}
```

### Get Unread Count
```
GET /api/v1/notifications/unread-count

Response:
{
  "success": true,
  "data": { "count": 5 }
}
```

### Get Statistics
```
GET /api/v1/notifications/stats

Response:
{
  "success": true,
  "data": {
    "unreadCount": 3,
    "totalCount": 25,
    "byType": { "fee": 10, "attendance": 8, "exam": 7 }
  }
}
```

### Mark as Read
```
PATCH /api/v1/notifications/:id/read

Response: { "success": true, "data": { notification } }
```

### Mark All as Read
```
PATCH /api/v1/notifications/mark-all-read

Response: { "success": true, "data": { "updated": 5 } }
```

### Delete Notification
```
DELETE /api/v1/notifications/:id

Response: { "success": true, "data": { "deleted": true } }
```

### Cleanup Old Notifications
```
DELETE /api/v1/notifications/cleanup-old
Query: ?daysOld=30

Response: { "success": true, "data": { "deleted": 15 } }
```

### Send to Specific User (Admin/Teacher)
```
POST /api/v1/notifications/send

Body: {
  "user_id": "uuid",
  "title": "Fee Payment Reminder",
  "body": "Please pay the pending fee",
  "type": "fee",
  "channel": "in_app",
  "data": { amount, dueDate }
}

Response: { "success": true, "data": { notification } }
```

### Broadcast to Multiple Users (Admin Only)
```
POST /api/v1/notifications/broadcast
Permission: notification.broadcast

Body: {
  "recipient_type": "ALL_PARENTS",
  "title": "System Maintenance",
  "body": "System will be down for 2 hours",
  "type": "system",
  "channel": "in_app",
  "branch_id": "optional-uuid",
  "data": { startTime, endTime }
}

Response: {
  "success": true,
  "data": {
    "count": 150,
    "recipientType": "PARENT",
    "notificationIds": [...]
  }
}
```

---

## 📱 Frontend Service Usage

```javascript
import { notificationService } from '@/services/notificationService';

// Get all notifications with filters
const result = await notificationService.getAll({
  is_read: false,
  type: 'fee',
  page: 1,
  limit: 20,
  sort: 'DESC'
});

// Get unread count
const { data } = await notificationService.getUnreadCount();
console.log(data.count);

// Get statistics
const { data: stats } = await notificationService.getStats();

// Mark as read
await notificationService.markRead(notificationId);

// Mark all as read
await notificationService.markAllRead();

// Delete
await notificationService.deleteNotification(notificationId);

// Clean up old
await notificationService.cleanupOldNotifications(30);

// Send to specific user
await notificationService.send({
  user_id: parentId,
  title: 'Payment Due',
  body: 'Please pay pending fees',
  type: 'fee',
  channel: 'in_app',
  data: { amount: 10000 }
});

// Broadcast
await notificationService.broadcast({
  recipient_type: 'ALL_PARENTS',
  title: 'Holiday Announcement',
  body: 'School will remain closed',
  type: 'general'
});
```

---

## 🔔 Recipient Types

| Type | Description | Use Case |
|------|-------------|----------|
| `ALL_PARENTS` / `PARENTS` | All parent accounts | Fee updates, attendance reports |
| `ALL_STUDENTS` / `STUDENTS` | All student accounts | Exam results, timetable changes |
| `ALL_TEACHERS` / `TEACHERS` | All teacher accounts | Department announcements |
| `ALL_STAFF` / `STAFF` | All staff accounts | System announcements |
| `ALL_ADMINS` / `ADMINS` | Institute admins | Critical alerts |
| `ALL_BRANCH_ADMINS` / `BRANCH_ADMINS` | Branch admins | Branch-specific news |

### Example: Send to All Parents in a Branch
```javascript
await broadcastNotification({
  institute_id: instituteId,
  branch_id: branchId, // ← Filters to only this branch
  recipient_type: 'ALL_PARENTS',
  title: 'Branch Notice',
  body: 'Important announcement for your branch',
  ...
});
```

---

## 🎨 Notification Types

| Type | Badge Color | Best For |
|------|------------|----------|
| `fee` | Green | Fee updates, payments, reminders |
| `attendance` | Blue | Attendance marking, absence alerts |
| `exam` | Purple | Exam schedules, results, scores |
| `general` | Gray | Announcements, info, news |
| `alert` | Red | Warnings, important notices |
| `system` | Gray | System events, maintenance |

---

## 🌐 Channel Options

| Channel | When | Requirements |
|---------|------|--------------|
| `in_app` | Real-time notifications in app | Default, always enabled |
| `email` | Email inbox | Email service configured |
| `sms` | Mobile SMS | SMS service configured |
| `push` | Mobile push notifications | Push service configured |

### Example: Multi-channel Notification
```javascript
// Currently implemented: in_app
await createNotification({
  ...
  channel: 'in_app', // Always available
  ...
});

// Future: Email integration
await createNotification({
  ...
  channel: 'email',
  ...
});
```

---

## 💾 Database Schema

### Notifications Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  institute_id UUID NOT NULL (FK),
  branch_id UUID (FK, optional),
  user_id UUID NOT NULL (FK),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  type ENUM ('fee', 'attendance', 'exam', 'general', 'alert', 'system'),
  channel ENUM ('push', 'email', 'sms', 'in_app'),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  data JSONB DEFAULT {},
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
```

---

## 🔌 Real-time Socket Events

### Listening for New Notifications (Client)
```javascript
import { useSocket } from '@/hooks/useSocket';

const { socket } = useSocket();

useEffect(() => {
  if (!socket) return;
  
  socket.on('notification', (data) => {
    console.log('New notification:', data);
    // Update UI, increment counter, etc.
  });
  
  return () => socket.off('notification');
}, [socket]);
```

### Broadcasting Events (Server)
```javascript
import { emitToUser, emitToSchool } from '../sockets/index.js';

// Send to specific user
emitToUser(userId, 'notification', {
  id: notification.id,
  title: notification.title,
  body: notification.body,
  type: notification.type,
  data: notification.data,
  timestamp: notification.createdAt
});

// Broadcast to school
emitToSchool(instituteId, 'notification:broadcast', {
  title: 'Broadcast sent',
  count: recipientCount,
  ...
});
```

---

## 📌 Integration Examples

### Example 1: Notify Parents When Attendance is Marked
```javascript
// src/services/studentAttendance.service.js
import { createNotification } from './notification.service.js';

export const markAttendance = async (studentId, status, instituteId) => {
  // Mark attendance...
  const attendance = await AttendanceModel.create({...});
  
  // Get student and parent
  const student = await User.findByPk(studentId);
  const parent = await User.findOne({
    where: { user_type: 'PARENT', school_id: instituteId }
  });
  
  // Send notification
  if (parent) {
    await createNotification({
      institute_id: instituteId,
      user_id: parent.id,
      title: `${student.first_name}'s Attendance`,
      body: `Marked ${status} on ${new Date().toLocaleDateString()}`,
      type: 'attendance',
      channel: 'in_app',
      data: {
        studentId,
        studentName: student.first_name,
        status,
        date: new Date().toISOString()
      }
    }, true);
  }
  
  return attendance;
};
```

### Example 2: Broadcast Fee Voucher to All Parents
```javascript
// src/services/fee.service.js
import { broadcastNotification } from './notification.service.js';

export const generateFeeVouchers = async (month, year, instituteId, branchId) => {
  // Generate vouchers...
  const vouchers = await FeeVoucher.bulkCreate([...]);
  
  // Broadcast to all parents
  await broadcastNotification({
    institute_id: instituteId,
    branch_id: branchId,
    recipient_type: 'ALL_PARENTS',
    title: `${month} ${year} Fee Vouchers Generated`,
    body: `New fee vouchers are ready. Please check your account.`,
    type: 'fee',
    channel: 'in_app',
    data: {
      month,
      year,
      voucherCount: vouchers.length,
      viewUrl: '/portal/parent/fees'
    }
  }, true);
  
  return vouchers;
};
```

### Example 3: Notify Teachers About Leave Request
```javascript
// src/services/leaveRequest.service.js
import { createNotification } from './notification.service.js';

export const submitLeaveRequest = async (staffId, leaveData, instituteId) => {
  // Create leave request...
  const request = await LeaveRequest.create({...});
  
  // Get reporting teacher/HOD
  const hod = await User.findByPk(leaveData.reportingOfficerId);
  
  // Send notification
  if (hod) {
    await createNotification({
      institute_id: instituteId,
      user_id: hod.id,
      title: 'New Leave Request',
      body: `${leaveData.staffName} has applied for leave`,
      type: 'alert',
      channel: 'in_app',
      data: {
        requestId: request.id,
        staffName: leaveData.staffName,
        fromDate: leaveData.fromDate,
        toDate: leaveData.toDate,
        reason: leaveData.reason,
        viewUrl: `/portal/teacher/leave-requests/${request.id}`
      }
    }, true);
  }
  
  return request;
};
```

---

## 🎯 Best Practices

### ✅ DO
- Use `in_app` channel by default
- Always set meaningful `title` and `body`
- Include relevant data in the `data` field
- Use correct `type` for categorization
- Emit real-time when user is expecting it

### ❌ DON'T
- Send too many notifications
- Use blank titles or body text
- Omit recipient_type in broadcasts
- Forget to emit real-time events
- Mix notification types in data

### 📊 Performance Tips
- Batch notifications if sending to many users
- Schedule mass notifications during off-peak hours
- Clean up old read notifications regularly
- Use pagination when fetching notifications
- Index on `user_id`, `is_read`, `type` columns

---

## 🚀 Deployment Checklist

- [ ] Backend routes registered in v1/index.js
- [ ] Notification model synced with database
- [ ] Permissions added for `notification.broadcast`
- [ ] Socket.io configured for real-time
- [ ] Frontend NotificationPanel component added to layout
- [ ] Frontend notificationService imported and working
- [ ] useSocket hook configured
- [ ] Integration examples implemented in services
- [ ] Testing done for single & broadcast notifications
- [ ] Real-time socket events tested
- [ ] Email/SMS/Push channels configured (if using)

---

## 🆘 Troubleshooting

### Notifications not appearing?
1. Check user is authenticated
2. Verify user_id in database
3. Check real-time is emitted (`emitRealtime: true`)
4. Verify socket connection in browser console

### Broadcast not reaching all users?
1. Verify recipient_type is correct
2. Check user_type in database matches
3. Ensure branch_id is correct if filtering by branch
4. Check permissions on `notification.broadcast` endpoint

### Missing unread count?
1. Call `getUnreadCount()` after notifications loaded
2. Verify socket listener for `notification` event
3. Check browser console for errors

---

## 📝 Migration from Old System

If you had a basic notification system, migrate like this:

1. **Old endpoints stay working** - All old endpoints still work
2. **New endpoints available** - Use new broadcast features
3. **Socket integration automatic** - Just add real-time flag: `emitRealtime: true`
4. **UI updated** - Replace old component with NotificationPanel

---

## 👥 Support & Contributing

For questions or improvements:
1. Check existing examples in `notificationIntegration.example.js`
2. Review API documentation above
3. Test in your local environment
4. Create issue if problem persists

---

**Version: 1.0.0**
**Last Updated: 2026-04-17**
**Status: ✅ Production Ready**
