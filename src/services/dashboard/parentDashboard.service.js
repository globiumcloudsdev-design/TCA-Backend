// backend/src/services/dashboard/parentDashboard.service.js

/**
 * The Clouds Academy - Parent Dashboard Service
 * 
 * Parent ke liye complete portal data:
 * - My Wards (Children)
 * - Each ward's:
 *   - Attendance
 *   - Results
 *   - Fees
 *   - Homework
 *   - Timetable
 *   - Notices
 */

import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import * as studentService from './studentDashboard.service.js';

const { User } = models;

/**
 * Get complete parent dashboard data
 */
export const getParentDashboard = async (parentId, instituteId) => {
  const parent = await getParentDetails(parentId, instituteId);
  const wards = await getParentWards(parentId, instituteId);

  // Get dashboard data for each ward
  const wardsData = await Promise.all(
    wards.map(async (ward) => {
      const dashboard = await studentService.getStudentDashboard(ward.id, instituteId);
      return {
        ...ward,
        dashboard
      };
    })
  );

  const p = parent || {};
  return {
    parent: {
      id: p.id || parentId,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Parent',
      email: p.email,
      phone: p.phone,
      avatar: p.avatar_url
    },
    wards: wardsData || [],
    total_wards: wards.length,
    recent_notices: await getRecentNotices(instituteId),
    quick_actions: [
      { label: 'Pay Fees', icon: 'CreditCard', href: '/fees/pay' },
      { label: 'View Attendance', icon: 'CheckSquare', href: '/attendance' },
      { label: 'Check Results', icon: 'Award', href: '/results' },
      { label: 'Contact Teacher', icon: 'MessageCircle', href: '/messages' }
    ]
  };
};

/**
 * Get parent details
 */
const getParentDetails = async (parentId, instituteId) => {
  return await User.findOne({
    where: { 
      id: parentId, 
      school_id: instituteId, 
      user_type: 'PARENT' 
    }
  });
};

/**
 * Get parent's wards (children)
 */
const getParentWards = async (parentId, instituteId) => {
  // This assumes parent-child relationship is stored
  // Either in User.details.parent_ids array or separate table
  return await User.findAll({
    where: {
      school_id: instituteId,
      user_type: 'STUDENT',
      is_active: true,
      'details.parent_id': parentId
    },
    attributes: ['id', 'first_name', 'last_name', 'registration_no', 'avatar_url', 'details']
  });
};

/**
 * Get recent notices for parent
 */
const getRecentNotices = async (instituteId) => {
  // This would query notices
  return [
    {
      id: 1,
      title: 'Parent-Teacher Meeting',
      date: '28 Mar 2024',
      description: 'Annual parent-teacher meeting for all classes'
    },
    {
      id: 2,
      title: 'Fee Due Date Reminder',
      date: '25 Mar 2024',
      description: 'Last date for fee submission is 31st March'
    }
  ];
};

export default {
  getParentDashboard
};