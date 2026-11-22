/**
 * Student profile accessors. Class/section data lives under
 * details.studentDetails (and the active academic session), NOT details.class_id.
 */
export const getStudentAcademicInfo = (user) => {
  const sd = user?.details?.studentDetails || {};
  const active = (sd.academicSessions || []).find((s) => s.status === 'active');
  return {
    class_id: active?.class_id || sd.class_id || user?.details?.class_id || null,
    section_id: active?.section_id || sd.section_id || user?.details?.section_id || null,
    class_name: active?.class_name || sd.class_name || user?.details?.class_name || null,
    section_name: active?.section_name || sd.section_name || user?.details?.section_name || null,
    roll_no: active?.roll_no || sd.roll_no || user?.details?.roll_number || null,
    academic_year_id: active?.academic_year_id || sd.academic_year_id || null,
  };
};

export default { getStudentAcademicInfo };
