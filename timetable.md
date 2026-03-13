📌 Timetable Backend ka Complete Structure:

1. MODEL (Timetable.model.js)
   - id: Har timetable ki unique ID
   - school_id: Kis institute ka timetable
   - academic_year_id: Kis academic year ke liye
   - entity_type: school/coaching/academy/college/university
   - entity_ids: JSON mein store karta hai IDs (class_id, section_id, etc.)
   - name: Timetable ka naam
   - period_config: Periods ki timing (user khud define karega)
   - slots: Yahan saare slots store hote hain
   - is_active: Active hai ya nahi
   - created_by/updated_by: Kis user ne banaya/update kiya

2. SERVICE (timetable.service.js)
   - getTimetableEntities(): Dropdown ke liye data fetch karta hai
   - createTimetable(): Naya timetable banata hai
   - updateTimetable(): Timetable update karta hai (slots add/remove)
   - getAllTimetables(): Saare timetables fetch karta hai
   - getTimetableById(): Ek timetable ki details fetch karta hai
   - deleteTimetable(): Timetable delete karta hai
   - toggleTimetableStatus(): Activate/deactivate karta hai
   - checkTeacherConflict(): Teacher busy hai ya nahi check karta hai

3. CONTROLLER (timetable.controller.js)
   - Request se data nikalta hai
   - Service ko call karta hai
   - Response bhejta hai
   - Error handling karta hai
   - Transaction handle karta hai

4. ROUTES (timetable.routes.js)
   - GET    /entities      → Dropdown data
   - POST   /check-conflict → Teacher conflict check
   - POST   /               → Naya timetable create
   - GET    /               → Saare timetables
   - GET    /:id            → Ek timetable
   - PUT    /:id            → Timetable update
   - DELETE /:id            → Timetable delete
   - PATCH  /:id/toggle-status → Activate/deactivate

5. IMPORTANT POINTS
   - Period config mein user khud start_time, end_time de sakta hai
   - Study period aur break period ka type alag hai
   - Teacher conflict check lazmi hai
   - Har write operation transaction mein hona chahiye
   - Slots array mein GIN index laga hai performance ke liye