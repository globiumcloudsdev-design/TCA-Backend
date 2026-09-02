/**
 * The Clouds Academy — Institute Types Seeder
 *
 * Seeds the 6 core institute types.
 * Must run BEFORE any institute records are created (FK dependency).
 */

const INSTITUTE_TYPES = [
  {
    // id:          1,
    name:        'School',
    slug:        'school',
    description: 'Primary and secondary level educational institution (Grades 1–12)',
    icon:        '🏫',
    sort_order:  1,
    is_active:   true,
  },
  {
    // id:          2,
    name:        'College',
    slug:        'college',
    description: 'Intermediate and undergraduate level education (FSc, FA, BA, BSc)',
    icon:        '🎓',
    sort_order:  2,
    is_active:   true,
  },
  {
    // id:          3,
    name:        'Academy',
    slug:        'academy',
    description: 'Specialized skill-based or subject-specific academy',
    icon:        '🏅',
    sort_order:  3,
    is_active:   true,
  },
  {
    // id:          4,
    name:        'University',
    slug:        'university',
    description: 'Higher education institution offering degree programs',
    icon:        '🏛️',
    sort_order:  4,
    is_active:   true,
  },
  {
    // id:          5,
    name:        'Coaching',
    slug:        'coaching',
    description: 'Competitive exam preparation and coaching center (CSS, MDCAT, ECAT, etc.)',
    icon:        '📖',
    sort_order:  5,
    is_active:   true,
  },
  {
    // id:          6,
    name:        'Tuition Center',
    slug:        'tuition_center',
    description: 'Home or center-based tuition for school/college students',
    icon:        '✏️',
    sort_order:  6,
    is_active:   true,
  },
];

export const seedInstituteTypes = async (models) => {
  const { InstituteType } = models;
  let created = 0;
  let updated = 0;

  for (const typeData of INSTITUTE_TYPES) {
    let record = await InstituteType.findOne({
      where: { slug: typeData.slug },
      paranoid: false,
    });

    if (record) {
      if (record.deleted_at) {
        await record.restore();
      }
      await record.update({
        name:        typeData.name,
        description: typeData.description,
        icon:        typeData.icon,
        sort_order:  typeData.sort_order,
        is_active:   typeData.is_active,
      });
      updated++;
    } else {
      await InstituteType.create(typeData);
      created++;
    }
  }

  console.log(
    `✅ Institute Types: ${created} created, ${updated} updated (total: ${INSTITUTE_TYPES.length})`
  );
  return { created, updated };
};

export { INSTITUTE_TYPES };
