/**
 * Temporary script to create an exam with subjects
 * Run: node create-exam.js
 */

import models from './src/models/postgres/index.js';
import * as examService from './src/services/exam.service.js';

const { sequelize } = models;

const examData = {
  school_id: '2d371842-b985-4bf4-82ba-d970434b77e8',
  class_id: '3219ab71-e80b-4301-b594-198653cda8c2',
  academic_year_id: '64e82dd4-da51-4e65-9e9c-4fa104409cc7',
  name: 'Mid Term Exam - 2026',
  code: 'MID_TERM_2026_' + Date.now(),
  type: 'mid_term',
  category: 'theory',
  entity_type: 'school',
  description: 'Mid term examination for all 6 subjects',
  pass_percentage: 40,
  
  // Subject-wise schedules
  subject_schedules: [
    {
      subject_id: '8b3bbb85-4648-4038-bd21-28f12a731d9a',
      subject_name: 'Urdu',
      subject_code: '',
      date: '2026-04-05',
      start_time: '09:00:00',
      end_time: '12:00:00',
      duration_minutes: 180,
      total_marks: 100,
      pass_marks: 40,
      venue: 'Main Hall',
      room_no: 'Hall A'
    },
    {
      subject_id: 'a44ecdd4-2d8b-4b31-93d4-70222b0536a4',
      subject_name: 'English',
      subject_code: 'ENG-01',
      date: '2026-04-06',
      start_time: '09:00:00',
      end_time: '12:00:00',
      duration_minutes: 180,
      total_marks: 100,
      pass_marks: 40,
      venue: 'Main Hall',
      room_no: 'Hall B'
    },
    {
      subject_id: 'ffeebea2-5380-4e4e-ac80-bdc100d38691',
      subject_name: 'Math',
      subject_code: 'MATH-001',
      date: '2026-04-07',
      start_time: '09:00:00',
      end_time: '11:30:00',
      duration_minutes: 150,
      total_marks: 100,
      pass_marks: 40,
      venue: 'Main Hall',
      room_no: 'Hall C'
    },
    {
      subject_id: '1f00b247-77c6-4fb5-b5ae-20ce53c2a824',
      subject_name: 'Science',
      subject_code: 'SCE-001',
      date: '2026-04-08',
      start_time: '09:00:00',
      end_time: '12:00:00',
      duration_minutes: 180,
      total_marks: 100,
      pass_marks: 40,
      venue: 'Lab A',
      room_no: 'Lab 01'
    },
    {
      subject_id: '818d8f11-cbc1-4728-ac57-33a3c7fcef0f',
      subject_name: 'Sindhi',
      subject_code: 'Sindh-001',
      date: '2026-04-09',
      start_time: '10:00:00',
      end_time: '12:00:00',
      duration_minutes: 120,
      total_marks: 50,
      pass_marks: 20,
      venue: 'Main Hall',
      room_no: 'Hall D'
    },
    {
      subject_id: '76bbab4d-7b9d-452a-97d0-a3610e002c53',
      subject_name: 'Social Studies',
      subject_code: 'SST-01',
      date: '2026-04-10',
      start_time: '09:00:00',
      end_time: '11:00:00',
      duration_minutes: 120,
      total_marks: 50,
      pass_marks: 20,
      venue: 'Main Hall',
      room_no: 'Hall E'
    }
  ],
  
  status: 'scheduled',
  is_published: false
};

const createExam = async () => {
  try {
    console.log('[INFO] Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    console.log('[INFO] Creating exam using service...');
    const exam = await examService.createExam(examData);
    
    console.log('\n✅ Exam Created Successfully!');
    console.log('Exam ID:', exam.id);
    console.log('Exam Name:', exam.name);
    console.log('Exam Code:', exam.code);
    console.log('Total Subjects:', exam.subject_schedules?.length || 0);
    console.log('Total Marks:', exam.total_marks);
    console.log('Pass Marks:', exam.pass_marks);
    console.log('Start Date:', exam.start_date);
    console.log('End Date:', exam.end_date);
    
    console.log('\n📚 Created Subjects:');
    exam.subject_schedules?.forEach((s, idx) => {
      console.log(`${idx+1}. ${s.subject_name} - ${s.total_marks} marks`);
    });

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createExam();
