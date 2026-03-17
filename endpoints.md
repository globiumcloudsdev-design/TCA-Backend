Teacher Portal Api End points

GET    /api/v1/portal/teacher/dashboard
GET    /api/v1/portal/teacher/profile
PUT    /api/v1/portal/teacher/profile

GET    /api/v1/portal/teacher/classes
GET    /api/v1/portal/teacher/classes/:classId

GET    /api/v1/portal/teacher/students
GET    /api/v1/portal/teacher/students/:studentId

POST   /api/v1/portal/teacher/assignments
GET    /api/v1/portal/teacher/assignments
GET    /api/v1/portal/teacher/assignments/:assignmentId
PUT    /api/v1/portal/teacher/assignments/:assignmentId
DELETE /api/v1/portal/teacher/assignments/:assignmentId

GET    /api/v1/portal/teacher/assignments/:assignmentId/submissions
POST   /api/v1/portal/teacher/submissions/:submissionId/grade

POST   /api/v1/portal/teacher/attendance/mark
GET    /api/v1/portal/teacher/attendance/class/:classId
GET    /api/v1/portal/teacher/attendance/student/:studentId

GET    /api/v1/portal/teacher/timetable
GET    /api/v1/portal/teacher/notices



Student Portal Endpoints

GET    /api/v1/portal/student/dashboard
GET    /api/v1/portal/student/profile
PUT    /api/v1/portal/student/profile

GET    /api/v1/portal/student/classes
GET    /api/v1/portal/student/timetable
GET    /api/v1/portal/student/today-classes

GET    /api/v1/portal/student/attendance

GET    /api/v1/portal/student/assignments
GET    /api/v1/portal/student/assignments/upcoming
POST   /api/v1/portal/student/assignments/:assignmentId/submit

GET    /api/v1/portal/student/results
GET    /api/v1/portal/student/results/recent

GET    /api/v1/portal/student/fees
GET    /api/v1/portal/student/fees/summary

GET    /api/v1/portal/student/notices
GET    /api/v1/portal/student/notices/recent

GET    /api/v1/portal/student/library



Parent Portal Api Routes Endpoints

GET    /api/v1/portal/parent/dashboard
GET    /api/v1/portal/parent/profile
PUT    /api/v1/portal/parent/profile

GET    /api/v1/portal/parent/children
GET    /api/v1/portal/parent/children/:childId

GET    /api/v1/portal/parent/children/:childId/attendance
GET    /api/v1/portal/parent/children/:childId/results
GET    /api/v1/portal/parent/children/:childId/fees
GET    /api/v1/portal/parent/children/:childId/assignments
GET    /api/v1/portal/parent/children/:childId/timetable

POST   /api/v1/portal/parent/fees/pay/:voucherId
GET    /api/v1/portal/parent/payments/history

GET    /api/v1/portal/parent/teachers
GET    /api/v1/portal/parent/notices