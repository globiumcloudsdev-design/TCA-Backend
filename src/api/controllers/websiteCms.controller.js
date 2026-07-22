import fs from 'fs';
import catchAsync from '../../utils/lib/catchAsync.js';
import { sendSuccess } from '../../utils/helpers/response.helper.js';
import models from '../../models/postgres/index.js';
import { getIO } from '../../sockets/index.js';
import logger from '../../config/logger.js';
import { AppError } from '../../utils/lib/AppError.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';
import { logAuditAction } from '../../utils/helpers/auditLogger.js';

const { WebsiteCms } = models;

/**
 * Helper to ensure table exists and is populated with high-fidelity defaults
 */
const ensureTableAndDefaults = async () => {
  // Ensure the table is created
  await WebsiteCms.sync({ force: false });

  const count = await WebsiteCms.count();
  if (count === 0) {
    logger.info('🌱 Database WebsiteCms table is empty. Seeding defaults...');
    
    const defaults = [
      {
        key: 'hero',
        value: {
          title: 'Empowering Schools with Smart Management',
          subtitle: 'The most comprehensive and easy-to-use school management system.',
          primaryBtn: 'Get Started',
          secondaryBtn: 'Watch Demo',
          mockupAsset: 'https://placehold.co/1200x675'
        },
        description: 'Landing Page Hero Section configs'
      },
      {
        key: 'features',
        value: [
          { id: 1, title: 'Biometric Attendance', icon: 'Fingerprint', desc: 'Real-time student and staff check-in with auto SMS delivery to parent mobile devices.', badge: 'Popular' },
          { id: 2, title: 'Dynamic Fee Configurator', icon: 'DollarSign', desc: 'Configure customized fee vouchers, sibling discounts, scholarship waivers, and track default lists.', badge: 'Default' },
          { id: 3, title: 'Report Cards Compiler', icon: 'GraduationCap', desc: 'Auto compile exam marksheets, positions, class GPA scores and publish beautiful PDF cards.', badge: 'New' }
        ],
        description: 'Showcase features grid cards'
      },
      {
        key: 'pricing',
        value: {
          basePrice: 5000,
          perStudentRate: 15,
          discountThreshold: 500,
          discountPercentage: 10
        },
        description: 'Dynamic price calculator rules'
      },
      {
        key: 'countdown',
        value: {
          title: 'Flash Sale: 50% Off for 1st Month!',
          endDate: '2026-06-01T00:00',
          description: 'Register your institute before the timer ends.',
          active: true,
          buttonText: 'Claim Offer',
          buttonLink: '/register'
        },
        description: 'Campaign discount countdown settings'
      },
      {
        key: 'banners',
        value: [
          { id: 1, title: 'Summer Promotion: 20% Off All Subscription Plans!', imageUrl: 'https://placehold.co/1200x400', link: '/pricing', active: true }
        ],
        description: 'Landing page promotional banners list'
      },
      {
        key: 'videos',
        value: [
          { id: 1, title: 'Complete ERP Walkthrough 2026', url: 'https://youtube.com/watch?v=demo', desc: '15-minute quick guide of Teacher, Student & Admin panels.', category: 'Demo' }
        ],
        description: 'Video showcase gallery entries'
      },
      {
        key: 'announcements',
        value: [
          { id: 1, text: '🎉 TCA v2.4.0 is now live! Introducing WhatsApp PDF Fee Vouchers integration.', active: true, color: '#2563eb' }
        ],
        description: 'News announcements marquee config'
      },
      {
        key: 'partners',
        value: [
          { id: 1, name: 'The City School', logoUrl: 'https://placehold.co/200x100' },
          { id: 2, name: 'Army Public School', logoUrl: 'https://placehold.co/200x100' }
        ],
        description: 'Trusted partners logos list'
      },
      {
        key: 'testimonials',
        value: [
          { id: 1, name: 'Dr. Ahmad Alvi', school: 'Beaconhouse School System', role: 'Regional Principal', content: 'TCA has streamlined our fee collection and automated payroll effortlessly. The dual A4 & POS printing center is exceptional!', videoUrl: 'https://youtube.com/watch?v=tca-demo' }
        ],
        description: 'Client success stories list'
      },
      {
        key: 'roadmap',
        value: [
          { id: 1, title: 'AI Facial Recognition Attendance', status: 'In Development', eta: 'Q3 2026' },
          { id: 2, title: 'Multi-Branch Fiscal Consolidation', status: 'Planning', eta: 'Q4 2026' }
        ],
        description: 'Platform upcoming updates roadmap'
      },
      {
        key: 'social',
        value: [
          { id: 1, platform: 'Facebook', url: 'https://facebook.com/thecloudsacademy' },
          { id: 2, platform: 'LinkedIn', url: 'https://linkedin.com/company/thecloudsacademy' }
        ],
        description: 'Social networking anchors'
      },
      {
        key: 'faq',
        value: [
          { id: 1, question: 'How long does it take to deploy TCA ERP in our branch?', answer: 'TCA ERP is cloud-based, so deployment takes less than 24 hours. Our support staff will pre-configure your classes, sections, and fee structures for you!' },
          { id: 2, question: 'Is the Student/Parent Portal accessible via Mobile App?', answer: 'Yes! TCA includes fully responsive portals for parents, students, and teachers, rendering seamlessly across all iOS and Android viewports.' }
        ],
        description: 'Help Center FAQs'
      },
      {
        key: 'seo',
        value: {
          metaTitle: 'The Clouds Academy | Smart School & College Management System ERP',
          metaDescription: 'Manage attendance, fee collections, online exams, staff timetables, and automated payroll systems in a secure, unified cloud environment.',
          metaKeywords: 'school erp, clouds academy, student portal, fee management system',
          googleAnalyticsId: 'G-74X9Y8Z1A2',
          facebookPixelId: 'FB-987654321',
          activeFavicon: 'https://placehold.co/32x32',
          activeOgImage: 'https://placehold.co/1200x630'
        },
        description: 'Search Engine Index configurations'
      },
      {
        key: 'leads',
        value: [
          { id: 1, name: 'Sajid Iqbal Chaudhry', schoolName: 'City Grammar High School', phone: '0300-1234567', email: 'sajid@citygrammar.edu.pk', status: 'New', date: '2026-05-19T14:30:00Z' }
        ],
        description: 'Contact leads generated from public form'
      },
      {
        key: 'privacy_policy',
        value: {
          title: 'Privacy Policy for The Clouds Academy ERP',
          lastUpdated: '2026-05-20',
          aboutPlatform: 'The Clouds Academy (TCA) is a premium school management system designed to facilitate seamless communication between administrators, teachers, parents, and students. Our cloud-based ERP streamlines fee invoicing, biometric attendance, report compiling, payroll management, and notifications into a single secure hub.',
          content: `1. INTRODUCTION\nWelcome to The Clouds Academy. We are committed to protecting the privacy of educational institutions, principals, teachers, parents, and students. This document outlines how we collect, process, and secure school records, communication logs, and personal data.\n\n2. INFORMATION WE COLLECT\nTo provide a comprehensive ERP experience, we collect:\n- School Profiles: Institute name, registered branches, contact directories, and financial setups.\n- Student & Parent Data: Names, GR numbers, enrolled classes, sibling relationships, parent phone numbers, and home addresses.\n- Attendance & Academic Progress: Daily check-in timestamps (including biometric device records), exam marks, GPA distributions, and homework files.\n- Fee Transactions: Invoices, fee template configurations, sibling discount logs, and invoice payment statuses.\n\n3. BIOMETRIC ATTENDANCE PROCESSING\nBiometric finger logs are processed strictly on local hardware gateways. Only anonymous, non-reversible mathematical check-in hashes are transmitted over secure TLS tunnels to our cloud servers to verify student and staff attendance status. No physical fingerprints are ever uploaded or stored in the cloud.\n\n4. COOKIES & TRACKING TECHNOLOGIES\nWe utilize session cookies to maintain administrative portal authentication and prevent cross-site request forgery attacks. Anonymous analytics logs may track portal feature usage to prioritize roadmap updates.\n\n5. SECURITY MEASURES & DATA PROTECTION\nAll communications between browsers, mobile portals, and Neon PostgreSQL database engines are protected with high-grade SHA-256 TLS encryption. Backup snapshots are compiled daily in secure, redundant environments with strict role-based access protocols.\n\n6. DATA SHARING & THIRD-PARTY DISCLOSURES\nWe do not sell, rent, or distribute educational datasets to third-party advertisers. SMS notifications and WhatsApp fee vouchers are processed through secure, authorized telecommunication gateway tunnels.\n\n7. CONTACT INFORMATION\nFor data protection inquiries or policy reviews, please email support@cloudsacademy.pk or contact our regional head office in Islamabad.`
        },
        description: 'Legal Privacy Policy documentation'
      },
      {
        key: 'account_delete_policy',
        value: {
          title: 'Account Deactivation & Deletion Policy',
          lastUpdated: '2026-05-20',
          content: 'Registered institutes or individual platform users (school admins, teachers, parents, students) can request permanent deletion of their account records. Upon verification by the respective school principal, all student grades, biometric records, and parent profiles will be permanently pruned from active and backup clusters within 30 business days.'
        },
        description: 'Legal User Account Deletion documentation'
      },
      {
        key: 'about_sections',
        value: [
          {
            id: 1,
            title: 'Our Core Mission & Vision',
            desc: 'The Clouds Academy (TCA) was built with a single vision: to digitally transform every school in Pakistan and beyond. We empower educational institutions of all sizes — from neighborhood primary schools to multi-campus college systems — by delivering a secure, intuitive, and unified ERP ecosystem.\n\nOur mission is to eliminate paperwork, automate fee collection cycles, streamline attendance tracking, and give principals real-time visibility into every department. Every feature we build is shaped by real feedback from school admins, parents, and teachers — ensuring TCA always stays practical and purpose-driven.',
            imageUrl: '',
            imageUrlPublicId: '',
            active: true
          },
          {
            id: 2,
            title: 'Enterprise-Grade Security',
            desc: 'At The Clouds Academy, protecting your institution\'s data is our highest priority. Every communication between your portal and our Neon PostgreSQL cloud cluster travels through SHA-256 TLS encrypted tunnels — the same standard trusted by major global banks.\n\nBiometric attendance records are processed locally on your hardware gateways; only anonymous check-in hashes are ever transmitted. All student academic records, fee ledgers, and staff payroll entries are backed up automatically every 24 hours with redundant, geo-distributed snapshots — so your data is always safe, always recoverable, and never sold to any third party.',
            imageUrl: '',
            imageUrlPublicId: '',
            active: true
          },
          {
            id: 3,
            title: 'Dedicated Local Support & Onboarding',
            desc: 'Switching to a new ERP can feel daunting — but with TCA, you are never alone. Our Pakistan-based support team is available Monday to Saturday, 9 AM to 7 PM, to assist with every step of your deployment journey.\n\nFrom pre-loading your student registers and fee templates to training your office staff on report card generation and payroll processing, our onboarding specialists walk alongside you. Most campuses are fully live within 24–48 hours. And once you are up and running, our dedicated helpdesk, tutorial library, and WhatsApp support channel ensure that help is always just one message away.',
            imageUrl: '',
            imageUrlPublicId: '',
            active: true
          }
        ],
        description: 'Multi-item custom sections within the landing page About Us panel'
      },
      {
        key: 'branding',
        value: {
          primaryColor: '#4F46E5',
          secondaryColor: '#0F172A'
        },
        description: 'Global SaaS branding theme colors'
      }
    ];

    for (const item of defaults) {
      await WebsiteCms.create(item);
    }
    logger.info('✅ Successfully seeded WebsiteCms defaults into database!');
  }
};

export const websiteCmsController = {
  /**
   * Get all Website CMS settings
   * GET /master-admin/website-cms
   */
  getSettings: catchAsync(async (req, res) => {
    await ensureTableAndDefaults();
    
    const settings = await WebsiteCms.findAll();
    
    // Reduce array to a single unified configuration object
    const configObj = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    
    sendSuccess(res, configObj, 'Website CMS configurations loaded successfully from Postgres.');
  }),

  /**
   * Update Website CMS configurations in bulk or by a specific key
   * POST /master-admin/website-cms
   */
  updateSettings: catchAsync(async (req, res) => {
    await ensureTableAndDefaults();
    
    const { key, value } = req.body;
    
    if (key && value !== undefined) {
      // Single key update
      let setting = await WebsiteCms.findByPk(key);
      if (setting) {
        await setting.update({
          value,
          updated_by: req.user?.id
        });
      } else {
        setting = await WebsiteCms.create({
          key,
          value,
          created_by: req.user?.id,
          updated_by: req.user?.id
        });
      }
      
      // Live updates broadcast via Socket.io
      try {
        const io = getIO();
        io.emit('website_cms:update', { key, value: setting.value });
        logger.info(`⚡ Broadcasted Website CMS update [${key}] via Socket.io`);
      } catch (e) {
        logger.warn(`⚠️ Socket broadcast skipped: ${e.message}`);
      }
      
      await logAuditAction({
        req,
        action: 'UPDATE_WEBSITE_CMS_SETTING',
        entity: 'WebsiteCms',
        entity_id: key,
        new_values: { key, value: setting.value }
      });
      
      return sendSuccess(res, setting.value, `CMS setting ${key} updated successfully.`);
    } else {
      // Bulk update (all keys in payload)
      const keys = Object.keys(req.body);
      const results = {};
      
      for (const k of keys) {
        let setting = await WebsiteCms.findByPk(k);
        if (setting) {
          await setting.update({
            value: req.body[k],
            updated_by: req.user?.id
          });
        } else {
          setting = await WebsiteCms.create({
            key: k,
            value: req.body[k],
            created_by: req.user?.id,
            updated_by: req.user?.id
          });
        }
        results[k] = setting.value;
      }
      
      // Live updates broadcast via Socket.io
      try {
        const io = getIO();
        io.emit('website_cms:bulk_update', results);
        logger.info(`⚡ Broadcasted bulk Website CMS updates via Socket.io`);
      } catch (e) {
        logger.warn(`⚠️ Socket broadcast skipped: ${e.message}`);
      }
      
      await logAuditAction({
        req,
        action: 'BULK_UPDATE_WEBSITE_CMS_SETTINGS',
        entity: 'WebsiteCms',
        new_values: results
      });
      
      return sendSuccess(res, results, 'All CMS configurations updated successfully in bulk.');
    }
  }),

  /**
   * Upload image to Cloudinary and delete old image if specified
   * POST /master-admin/website-cms/upload
   */
  uploadImage: catchAsync(async (req, res) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }
    
    const { folder = 'general', oldPublicId } = req.body;
    const folderPath = `the-clouds-academy/website-cms/${folder}`;
    
    // 1. Delete old image if present on Cloudinary
    if (oldPublicId) {
      try {
        await deleteFromCloudinary(oldPublicId, 'image');
        logger.info(`✅ Successfully deleted old Cloudinary asset: ${oldPublicId}`);
      } catch (err) {
        logger.error(`⚠️ Failed to delete old Cloudinary asset ${oldPublicId}:`, err);
      }
    }
    
    // 2. Upload new image to Cloudinary folder
    const uploadResult = await uploadToCloudinary(req.file.path, folderPath, { resource_type: 'image' });
    
    // Clean up temporary local file
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (e) {
      logger.warn(`⚠️ Failed to clean up temp file ${req.file.path}: ${e.message}`);
    }
    
    await logAuditAction({
      req,
      action: 'UPLOAD_WEBSITE_CMS_IMAGE',
      entity: 'WebsiteCms',
      new_values: { url: uploadResult.url, publicId: uploadResult.public_id, folder }
    });
    
    sendSuccess(res, {
      url: uploadResult.url,
      publicId: uploadResult.public_id
    }, 'Image uploaded successfully to Cloudinary.');
  })
};
