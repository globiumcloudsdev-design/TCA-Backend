// backend/src/services/dashboard/masterDashboard.service.js

/**
 * The Clouds Academy - Master Dashboard Service
 * 
 * Master Admin ke liye overall institute statistics
 */

import { Op } from 'sequelize';
import models from '../../models/postgres/index.js';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

const { Institute, User, Invoice, sequelize } = models;

/**
 * Get master dashboard statistics
 */
export const getMasterDashboardStats = async () => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonth = subMonths(now, 1);
  const lastMonthStart = startOfMonth(lastMonth);
  const lastMonthEnd = endOfMonth(lastMonth);

  // Parallel queries for performance
  const [
    totalInstitutes,
    activeInstitutes,
    totalUsers,
    totalTeachers,
    totalStudents,
    monthlyRevenue,
    lastMonthRevenue,
    pendingInvoices,
    overdueInvoices,
    recentInstitutes,
    recentInvoices,
    instituteGrowth
  ] = await Promise.all([
    // Basic counts
    Institute.count(),
    Institute.count({ where: { is_active: true } }),
    User.count(),
    User.count({ where: { user_type: 'TEACHER' } }),
    User.count({ where: { user_type: 'STUDENT' } }),

    // Monthly revenue
    Invoice.sum('total_amount', {
      where: {
        status: 'PAID',
        paid_at: {
          [Op.between]: [monthStart, monthEnd]
        }
      }
    }),

    // Last month revenue
    Invoice.sum('total_amount', {
      where: {
        status: 'PAID',
        paid_at: {
          [Op.between]: [lastMonthStart, lastMonthEnd]
        }
      }
    }),

    // Pending invoices
    Invoice.count({
      where: {
        status: 'PENDING',
        due_date: { [Op.gte]: now }
      }
    }),

    // Overdue invoices
    Invoice.count({
      where: {
        status: 'PENDING',
        due_date: { [Op.lt]: now }
      }
    }),

    // Recent institutes (last 10)
    Institute.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
      include: [
        { model: models.InstituteType, as: 'type', attributes: ['name', 'icon'] },
        { model: models.SubscriptionPlan, as: 'plan', attributes: ['name'] }
      ]
    }),

    // Recent invoices (last 10)
    Invoice.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
      include: [
        { 
          model: Institute, 
          as: 'institute',
          attributes: ['id', 'institute_name', 'institute_code', 'institute_logo_url']
        }
      ]
    }),

    // Institute growth over last 6 months
    getInstituteGrowth()
  ]);

  // Calculate revenue growth
  const revenueGrowth = lastMonthRevenue 
    ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
    : 0;

  return {
    overview: {
      total_institutes: totalInstitutes,
      active_institutes: activeInstitutes,
      inactive_institutes: totalInstitutes - activeInstitutes,
      active_percentage: Math.round((activeInstitutes / totalInstitutes) * 100) || 0
    },
    users: {
      total_users: totalUsers,
      total_teachers: totalTeachers,
      total_students: totalStudents,
      other_users: totalUsers - totalTeachers - totalStudents
    },
    revenue: {
      current_month: monthlyRevenue || 0,
      last_month: lastMonthRevenue || 0,
      growth_percentage: Math.round(revenueGrowth * 100) / 100,
      pending_invoices: pendingInvoices,
      overdue_invoices: overdueInvoices
    },
    recent_institutes: recentInstitutes.map(inst => ({
      id: inst.id,
      name: inst.institute_name,
      code: inst.institute_code,
      type: inst.type?.name,
      icon: inst.type?.icon,
      plan: inst.plan?.name,
      status: inst.is_active ? 'active' : 'inactive',
      created_at: inst.created_at
    })),
    recent_invoices: recentInvoices.map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      institute: inv.institute?.institute_name,
      institute_code: inv.institute?.institute_code,
      amount: inv.total_amount,
      status: inv.status,
      due_date: inv.due_date,
      created_at: inv.created_at
    })),
    growth_chart: instituteGrowth
  };
};

/**
 * Get institute growth over last 6 months
 */
const getInstituteGrowth = async () => {
  const months = [];
  const counts = [];

  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const count = await Institute.count({
      where: {
        created_at: {
          [Op.between]: [monthStart, monthEnd]
        }
      }
    });

    months.push(format(date, 'MMM yyyy'));
    counts.push(count);
  }

  return { months, counts };
};

/**
 * Get institute type distribution
 */
export const getInstituteTypeDistribution = async () => {
  const result = await Institute.findAll({
    attributes: [
      'institute_type_id',
      [sequelize.fn('COUNT', sequelize.col('institute_type_id')), 'count']
    ],
    include: [
      { model: models.InstituteType, as: 'type', attributes: ['name', 'icon'] }
    ],
    group: ['institute_type_id', 'type.id', 'type.name', 'type.icon']
  });

  return result.map(item => ({
    type_id: item.institute_type_id,
    type_name: item.type?.name,
    icon: item.type?.icon,
    count: parseInt(item.dataValues.count)
  }));
};

/**
 * Get subscription plan distribution
 */
export const getSubscriptionDistribution = async () => {
  const result = await Institute.findAll({
    attributes: [
      'subscription_plan_id',
      [sequelize.fn('COUNT', sequelize.col('subscription_plan_id')), 'count']
    ],
    include: [
      { model: models.SubscriptionPlan, as: 'plan', attributes: ['name', 'price'] }
    ],
    where: { subscription_plan_id: { [Op.ne]: null } },
    group: ['subscription_plan_id', 'plan.id', 'plan.name', 'plan.price']
  });

  const total = result.reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);

  return result.map(item => ({
    plan_id: item.subscription_plan_id,
    plan_name: item.plan?.name,
    price: item.plan?.price,
    count: parseInt(item.dataValues.count),
    percentage: Math.round((parseInt(item.dataValues.count) / total) * 100) || 0
  }));
};

export default {
  getMasterDashboardStats,
  getInstituteTypeDistribution,
  getSubscriptionDistribution
};