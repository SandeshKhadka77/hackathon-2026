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

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[demo] connected to MongoDB');

    console.log('[demo] running scraper sync...');
    const scrapeResult = await runScraperAndUpsert();
    console.log('[demo] scraper result:', scrapeResult);

    const { demoUser } = await ensureDemoUsers();

    const tenders = await Tender.find({ isActive: true }).sort({ deadlineAt: 1, createdAt: -1 }).limit(20);
    if (!tenders.length) {
      throw new Error('No tenders found after scrape. Check scraper source availability.');
    }

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
