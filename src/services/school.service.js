/**
 * The Clouds Academy - Institute Service (replaces school.service.js)
 *
 * Institute profile + role assignment.
 * Role permissions are stored as JSONB directly on the Role record —
 * no separate RolePermission / Permission tables needed.
 */

import { Op } from 'sequelize';
import models from '../models/postgres/index.js';
import AppError from '../utils/lib/AppError.js';

const { Institute, Role } = models;

// ─── GET INSTITUTE PROFILE ────────────────────────────────────────────────────
export const getSchoolProfile = async (instituteId) => {
  const institute = await Institute.findByPk(instituteId, {
    attributes: { exclude: ['created_at', 'updated_at', 'deleted_at'] },
    include: [
      {
        model: Role,
        as:    'assignedRole',
        attributes: ['id', 'name', 'code', 'description', 'permissions'],
      },
    ],
  });

  if (!institute) throw AppError.notFound('Institute not found');
  return institute;
};

// ─── ASSIGN ROLE TO INSTITUTE ─────────────────────────────────────────────────
export const assignRoleToSchool = async (instituteId, roleId) => {
  const institute = await Institute.findByPk(instituteId);
  if (!institute) throw AppError.notFound('Institute not found');

  // Role must be a global template (school_id IS NULL) or belong to this institute
  const role = await Role.findOne({
    where: {
      id:      roleId,
      [Op.or]: [{ school_id: null }, { school_id: instituteId }],
    },
  });

  if (!role) throw AppError.badRequest('Role not found or does not belong to this institute');

  await institute.update({ institute_role_id: roleId });
  return getSchoolProfile(instituteId);
};

// ─── REMOVE ROLE FROM INSTITUTE ───────────────────────────────────────────────
export const removeRoleFromSchool = async (instituteId) => {
  const institute = await Institute.findByPk(instituteId);
  if (!institute) throw AppError.notFound('Institute not found');

  await institute.update({ institute_role_id: null });
  return { message: 'Role removed from institute successfully' };
};

// ─── UPDATE INSTITUTE SETTINGS ────────────────────────────────────────────────
export const updateSchoolSettings = async (instituteId, data) => {
  const institute = await Institute.findByPk(instituteId);
  if (!institute) throw AppError.notFound('Institute not found');

  await institute.update(data);
  return getSchoolProfile(instituteId);
};

