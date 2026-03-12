/**
 * The Clouds Academy - Student Controller
 */

import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/helpers/response.helper.js';
import {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
} from '../../services/student.service.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';

export const createStudentController = catchAsync(async (req, res) => {
  let photoData = {};
  if (req.file) {
    const uploaded = await uploadToCloudinary(req.file.path, 'students');
    photoData = { photo_url: uploaded.url, photo_public_id: uploaded.public_id };
  }

  const student = await createStudent(req.school.id, { ...req.body, ...photoData }, req.user.id);
  sendCreated(res, student, 'Student created successfully');
});

export const getStudentsController = catchAsync(async (req, res) => {
  const { students, pagination } = await getStudents(req.school.id, req.query);
  sendPaginated(res, students, pagination, 'Students fetched');
});

export const getStudentController = catchAsync(async (req, res) => {
  const student = await getStudentById(req.params.id, req.school.id);
  sendSuccess(res, student, 'Student details');
});

export const updateStudentController = catchAsync(async (req, res) => {
  let photoData = {};
  if (req.file) {
    const uploaded = await uploadToCloudinary(req.file.path, 'students');
    photoData = { photo_url: uploaded.url, photo_public_id: uploaded.public_id };
  }

  const student = await updateStudent(req.params.id, req.school.id, { ...req.body, ...photoData });
  sendSuccess(res, student, 'Student updated');
});

export const deleteStudentController = catchAsync(async (req, res) => {
  await deleteStudent(req.params.id, req.school.id);
  sendNoContent(res);
});

export default {
  createStudentController,
  getStudentsController,
  getStudentController,
  updateStudentController,
  deleteStudentController,
};
