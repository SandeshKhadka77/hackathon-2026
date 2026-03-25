const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Tender = require('./models/Tender');
const VendorPipeline = require('./models/VendorPipeline');
const Notification = require('./models/Notification');
const { runScraperAndUpsert } = require('./utils/scraper');
const { calculateMatchPercent } = require('./utils/matching');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hackathon_db';

const CURATED_DEMO_TENDERS = [
  {
    tenderId: 'DEMO-AP-2026-001',
    title: 'Urban Street Rehabilitation and Drainage Construction - Tokha Package A',
    procuringEntity: 'Tokha Municipality Infrastructure Division',
    category: 'Works',
    location: 'Tokha, Kathmandu',
    district: 'Kathmandu',
    amount: 23800000,
    deadlineRaw: '15-04-2026 12:00 NPT',
    deadlineAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/001',
    noticeUrl: 'https://example.org/demo/tenders/001-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/001-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/001-boq.xlsx',
  },
  {
    tenderId: 'DEMO-AP-2026-002',
    title: 'Public Building Retrofit and Structural Works - Ward Office Cluster',
    procuringEntity: 'Kathmandu Metropolitan Technical Unit',
    category: 'Works',
    location: 'Kuleshwor, Kathmandu',
    district: 'Kathmandu',
    amount: 24100000,
    deadlineRaw: '16-04-2026 13:00 NPT',
    deadlineAt: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/002',
    noticeUrl: 'https://example.org/demo/tenders/002-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/002-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/002-boq.xlsx',
  },
  {
    tenderId: 'DEMO-AP-2026-003',
    title: 'Bridge Approach Stabilization and Retaining Structure Construction',
    procuringEntity: 'Bagmati Provincial Roads Directorate',
    category: 'Works',
    location: 'Thankot, Kathmandu',
    district: 'Kathmandu',
    amount: 25600000,
    deadlineRaw: '17-04-2026 12:30 NPT',
    deadlineAt: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/003',
    noticeUrl: 'https://example.org/demo/tenders/003-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/003-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/003-boq.xlsx',
  },
  {
    tenderId: 'DEMO-AP-2026-004',
    title: 'Flood Mitigation Culvert and Embankment Civil Works - Package C',
    procuringEntity: 'Lalitpur Metropolitan Planning Cell',
    category: 'Works',
    location: 'Kalimati, Kathmandu',
    district: 'Kathmandu',
    amount: 24700000,
    deadlineRaw: '18-04-2026 11:00 NPT',
    deadlineAt: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/004',
    noticeUrl: 'https://example.org/demo/tenders/004-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/004-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/004-boq.xlsx',
  },
  {
    tenderId: 'DEMO-AP-2026-005',
    title: 'School Compound Upgrading and Masonry Construction - Bhaktapur Bundle',
    procuringEntity: 'Bhaktapur Municipal Engineering Section',
    category: 'Works',
    location: 'Gongabu, Kathmandu',
    district: 'Kathmandu',
    amount: 25200000,
    deadlineRaw: '19-04-2026 15:00 NPT',
    deadlineAt: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/005',
    noticeUrl: 'https://example.org/demo/tenders/005-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/005-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/005-boq.xlsx',
  },
  {
    tenderId: 'DEMO-AP-2026-006',
    title: 'Consultancy for Detailed Design of Urban Mobility Corridors',
    procuringEntity: 'Urban Development Support Office',
    category: 'Consulting',
    location: 'Pulchowk, Lalitpur',
    district: 'Lalitpur',
    amount: 5100000,
    deadlineRaw: '21-04-2026 12:00 NPT',
    deadlineAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/006',
    noticeUrl: 'https://example.org/demo/tenders/006-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/006-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/006-tor.pdf',
  },
  {
    tenderId: 'DEMO-AP-2026-007',
    title: 'Supply of Ready-Mix Concrete and Steel for Municipal Projects',
    procuringEntity: 'Kathmandu Supply Management Unit',
    category: 'Goods',
    location: 'Teku, Kathmandu',
    district: 'Kathmandu',
    amount: 8600000,
    deadlineRaw: '23-04-2026 12:00 NPT',
    deadlineAt: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/007',
    noticeUrl: 'https://example.org/demo/tenders/007-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/007-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/007-specifications.pdf',
  },
  {
    tenderId: 'DEMO-AP-2026-008',
    title: 'River Training and Gabion Civil Works Along Hanumante Corridor',
    procuringEntity: 'Water Induced Disaster Unit',
    category: 'Works',
    location: 'Madhyapur, Bhaktapur',
    district: 'Bhaktapur',
    amount: 17400000,
    deadlineRaw: '24-04-2026 11:30 NPT',
    deadlineAt: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/008',
    noticeUrl: 'https://example.org/demo/tenders/008-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/008-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/008-boq.xlsx',
  },
  {
    tenderId: 'DEMO-AP-2026-009',
    title: 'Procurement of Asphalt Plant Accessories and Safety Equipment',
    procuringEntity: 'Department of Roads Logistics Cell',
    category: 'Goods',
    location: 'Kalanki, Kathmandu',
    district: 'Kathmandu',
    amount: 7200000,
    deadlineRaw: '26-04-2026 14:00 NPT',
    deadlineAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/009',
    noticeUrl: 'https://example.org/demo/tenders/009-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/009-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/009-specifications.pdf',
  },
  {
    tenderId: 'DEMO-AP-2026-010',
    title: 'Rural Access Track Improvement and Slope Protection Works',
    procuringEntity: 'District Coordination Technical Office',
    category: 'Works',
    location: 'Dhulikhel, Kavrepalanchok',
    district: 'Kavrepalanchok',
    amount: 16300000,
    deadlineRaw: '27-04-2026 12:00 NPT',
    deadlineAt: new Date(Date.now() + 36 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/010',
    noticeUrl: 'https://example.org/demo/tenders/010-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/010-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/010-boq.xlsx',
  },
  {
    tenderId: 'DEMO-AP-2026-011',
    title: 'Consulting Services for Contract Management and QA Monitoring',
    procuringEntity: 'Provincial Infrastructure Monitoring Office',
    category: 'Consulting',
    location: 'Hetauda, Makwanpur',
    district: 'Makwanpur',
    amount: 4600000,
    deadlineRaw: '28-04-2026 13:00 NPT',
    deadlineAt: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/011',
    noticeUrl: 'https://example.org/demo/tenders/011-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/011-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/011-tor.pdf',
  },
  {
    tenderId: 'DEMO-AP-2026-012',
    title: 'Drain Cover Fabrication and Installation for Dense Urban Zones',
    procuringEntity: 'Metropolitan Asset Maintenance Center',
    category: 'Works',
    location: 'Baneshwor, Kathmandu',
    district: 'Kathmandu',
    amount: 14900000,
    deadlineRaw: '30-04-2026 12:00 NPT',
    deadlineAt: new Date(Date.now() + 39 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/012',
    noticeUrl: 'https://example.org/demo/tenders/012-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/012-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/012-boq.xlsx',
  },
  {
    tenderId: 'DEMO-AP-2026-013',
    title: 'Supply and Commissioning of Site Survey Instruments',
    procuringEntity: 'Technical Resource Support Division',
    category: 'Goods',
    location: 'Bharatpur, Chitwan',
    district: 'Chitwan',
    amount: 5900000,
    deadlineRaw: '01-05-2026 11:00 NPT',
    deadlineAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/013',
    noticeUrl: 'https://example.org/demo/tenders/013-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/013-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/013-specifications.pdf',
  },
  {
    tenderId: 'DEMO-AP-2026-014',
    title: 'Construction of Community Health Post Building - Lot 2',
    procuringEntity: 'Public Health Infrastructure Office',
    category: 'Works',
    location: 'Bungamati, Lalitpur',
    district: 'Lalitpur',
    amount: 18600000,
    deadlineRaw: '02-05-2026 15:00 NPT',
    deadlineAt: new Date(Date.now() + 41 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/014',
    noticeUrl: 'https://example.org/demo/tenders/014-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/014-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/014-boq.xlsx',
  },
  {
    tenderId: 'DEMO-AP-2026-015',
    title: 'Consultancy for EIA and Safeguard Monitoring of Urban Works',
    procuringEntity: 'Environmental Compliance Unit',
    category: 'Consulting',
    location: 'Putalisadak, Kathmandu',
    district: 'Kathmandu',
    amount: 3900000,
    deadlineRaw: '03-05-2026 12:00 NPT',
    deadlineAt: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
    detailUrl: 'https://example.org/demo/tenders/015',
    noticeUrl: 'https://example.org/demo/tenders/015-notice.pdf',
    requirementUrl: 'https://example.org/demo/tenders/015-eligibility.pdf',
    boqUrl: 'https://example.org/demo/tenders/015-tor.pdf',
  },
];

const CURATED_TENDER_IDS = new Set(CURATED_DEMO_TENDERS.map((item) => item.tenderId));

const ensureCuratedDemoTenders = async () => {
  for (const item of CURATED_DEMO_TENDERS) {
    const documentLinks = [
      { label: 'Notice PDF', url: item.noticeUrl, type: 'pdf' },
      { label: 'Detail Page', url: item.detailUrl, type: 'detail' },
      { label: 'Eligibility & Requirement', url: item.requirementUrl, type: 'other' },
      { label: 'BOQ / Specification', url: item.boqUrl, type: 'other' },
    ];

    await Tender.updateOne(
      { tenderId: item.tenderId },
      {
        $set: {
          ...item,
          documentLinks,
          sourceUrl: item.detailUrl,
          sourceFingerprint: `demo-${item.tenderId}`,
          scrapeRunId: 'demo-curated',
          parseConfidence: 99,
          sourcePage: 1,
          sourcePosition: 1,
          isActive: true,
          lastSeenAt: new Date(),
          scrapedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
};

const ensureDemoUsers = async () => {
  const userPasswordHash = await bcrypt.hash('DemoPass123', 10);
  const adminPasswordHash = await bcrypt.hash('AdminPass123', 10);

  const documents = {
    panVat: {
      originalName: 'pan-vat-demo.pdf',
      storedName: 'pan-vat-demo.pdf',
      mimeType: 'application/pdf',
      size: 120000,
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      reminderSentAt: null,
    },
    taxClearance: {
      originalName: 'tax-clearance-demo.pdf',
      storedName: 'tax-clearance-demo.pdf',
      mimeType: 'application/pdf',
      size: 98000,
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      reminderSentAt: null,
    },
    companyRegistration: {
      originalName: 'company-registration-demo.pdf',
      storedName: 'company-registration-demo.pdf',
      mimeType: 'application/pdf',
      size: 83000,
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + 220 * 24 * 60 * 60 * 1000),
      reminderSentAt: null,
    },
  };

  const demoUser = await User.findOneAndUpdate(
    { email: 'demo.vendor@avasarpatra.com' },
    {
      $set: {
        name: 'Demo Vendor',
        passwordHash: userPasswordHash,
        district: 'Kathmandu',
        category: 'Works',
        vendorGroup: 'Medium',
        organizationType: 'Private Limited',
        capacity: 22000000,
        expertiseTags: ['road', 'bridge', 'construction'],
        role: 'user',
        documents,
      },
      $setOnInsert: {
        email: 'demo.vendor@avasarpatra.com',
      },
    },
    { returnDocument: 'after', upsert: true }
  );

  const adminUser = await User.findOneAndUpdate(
    { email: 'admin@avasarpatra.com' },
    {
      $set: {
        name: 'Demo Admin',
        passwordHash: adminPasswordHash,
        district: 'Kathmandu',
        category: 'Works',
        vendorGroup: 'Large',
        organizationType: 'Private Limited',
        capacity: 50000000,
        expertiseTags: ['infrastructure'],
        role: 'admin',
      },
      $setOnInsert: {
        email: 'admin@avasarpatra.com',
      },
    },
    { returnDocument: 'after', upsert: true }
  );

  return { demoUser, adminUser };
};

const setupBookmarksAndPipelines = async (demoUser, tenders) => {
  const shortlist = tenders.slice(0, 6);
  demoUser.bookmarks = shortlist.map((item) => item._id);
  await demoUser.save();

  const pipelineTenders = shortlist.slice(0, 3);
  for (const [index, tender] of pipelineTenders.entries()) {
    const base = (index + 1) * 100000;
    await VendorPipeline.findOneAndUpdate(
      { user: demoUser._id, tender: tender._id },
      {
        $set: {
          status: index === 0 ? 'preparing' : 'watching',
          priority: index === 0 ? 'high' : 'medium',
          estimate: {
            emdAmount: 80000 + base,
            documentCost: 45000,
            logisticsCost: 125000 + base,
            laborCost: 250000 + base,
            contingencyCost: 50000,
            notes: 'Demo estimate generated for hackathon presentation.',
          },
          assignments: [
            {
              memberName: 'Aarav',
              role: 'Lead',
              task: 'Review tender notice and scope',
              dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
              done: true,
            },
            {
              memberName: 'Sita',
              role: 'Compliance',
              task: 'Compile bid security and statutory documents',
              dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
              done: false,
            },
          ],
          outcome: {
            result: 'pending',
            reason: '',
            learning: '',
            recordedAt: new Date(),
          },
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  }
};

const setupNotifications = async (demoUser, tenders) => {
  for (const tender of tenders.slice(0, 8)) {
    const matchPercent = calculateMatchPercent(tender.toObject(), demoUser);

    await Notification.updateOne(
      { user: demoUser._id, tender: tender._id },
      {
        $setOnInsert: {
          user: demoUser._id,
          tender: tender._id,
          title: `New opportunity: ${tender.title}`,
          reason: `Match ${matchPercent}% | Demo alert for boardroom walkthrough.`,
          type: 'match',
          channels: ['in_app'],
          emailStatus: 'skipped',
          metadata: {
            matchPercent,
            alertScore: Math.min(100, matchPercent + 8),
            alertLevel: matchPercent >= 75 ? 'high' : 'medium',
          },
          isRead: false,
        },
      },
      { upsert: true }
    );
  }
};

const prioritizeDemoTenders = (items = []) => {
  const curated = [];
  const others = [];

  items.forEach((item) => {
    if (CURATED_TENDER_IDS.has(item.tenderId)) {
      curated.push(item);
      return;
    }

    others.push(item);
  });

  return [...curated, ...others];
};

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[demo] connected to MongoDB');

    console.log('[demo] running scraper sync...');
    const scrapeResult = await runScraperAndUpsert();
    console.log('[demo] scraper result:', scrapeResult);

    // Curated tenders guarantee complete, presentation-ready records for demo storytelling.
    await ensureCuratedDemoTenders();

    const { demoUser } = await ensureDemoUsers();

    const activeTenders = await Tender.find({ isActive: true }).sort({ deadlineAt: 1, createdAt: -1 }).limit(60);
    if (!activeTenders.length) {
      throw new Error('No tenders found after scrape. Check scraper source availability.');
    }

    const tenders = prioritizeDemoTenders(activeTenders).slice(0, 15);

    await setupBookmarksAndPipelines(demoUser, tenders);
    await setupNotifications(demoUser, tenders);

    console.log('\n[demo] setup complete');
    console.log('[demo] user login: demo.vendor@avasarpatra.com / DemoPass123');
    console.log('[demo] admin login: admin@avasarpatra.com / AdminPass123');
    console.log('[demo] seeded tenders:', tenders.length);
  } catch (error) {
    console.error('[demo] setup failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('[demo] database connection closed');
  }
};

run();
