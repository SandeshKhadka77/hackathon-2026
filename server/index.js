const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const tenderRoutes = require('./routes/tenderRoutes');
const matchRoutes = require('./routes/matchRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const documentRoutes = require('./routes/documentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const operationsRoutes = require('./routes/operationsRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const jvRoutes = require('./routes/jvRoutes');
const { runScraperAndUpsert, sendDailyDigests } = require('./utils/scraper');

const app = express();

const DIGEST_SCHEDULER_ENABLED = process.env.DIGEST_SCHEDULER_ENABLED !== 'false';
const DIGEST_SCHEDULER_INTERVAL_MS = Number(process.env.DIGEST_SCHEDULER_INTERVAL_MS || 60 * 60 * 1000);
const SCRAPER_SCHEDULER_ENABLED = process.env.SCRAPER_SCHEDULER_ENABLED !== 'false';
const SCRAPER_SCHEDULER_INTERVAL_MS = Number(process.env.SCRAPER_SCHEDULER_INTERVAL_MS || 6 * 60 * 60 * 1000);

let isScraperRunning = false;

const runScraperScheduler = async () => {
    // Prevent overlapping long-running scraper runs when interval is shorter than execution time.
    if (isScraperRunning) {
        console.log('[scraper-scheduler] skipped because previous run is still in progress');
        return;
    }

    isScraperRunning = true;

    try {
        const result = await runScraperAndUpsert();
        console.log(
            `[scraper-scheduler] scraped=${result.totalScraped} processed=${result.totalProcessed} created=${result.createdCount} notifications=${result.notificationCount}`
        );
    } catch (error) {
        console.error('[scraper-scheduler] run failed:', error.message || error);
    } finally {
        isScraperRunning = false;
    }
};

const runDigestScheduler = async () => {
    try {
        const result = await sendDailyDigests();
        if (result.attempted > 0) {
            console.log(
                `[digest-scheduler] attempted=${result.attempted} sent=${result.sent} considered=${result.consideredUsers}`
            );
        }
    } catch (error) {
        console.error('[digest-scheduler] run failed:', error.message || error);
    }
};

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hackathon_db';

app.get('/api/status', (req, res) => {
    res.json({
        status: 'Online',
        message: 'Avasar Patra API is running.',
        dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/tenders', tenderRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/jv', jvRoutes);

const PORT = 5000;
const startServer = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected successfully.');

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on http://0.0.0.0:${PORT}`);

            if (SCRAPER_SCHEDULER_ENABLED) {
                // Initial delayed run warms data after startup; interval keeps tender feed fresh.
                console.log(`[scraper-scheduler] enabled, interval=${SCRAPER_SCHEDULER_INTERVAL_MS}ms`);
                setTimeout(() => {
                    runScraperScheduler();
                }, 20 * 1000);

                setInterval(() => {
                    runScraperScheduler();
                }, SCRAPER_SCHEDULER_INTERVAL_MS);
            } else {
                console.log('[scraper-scheduler] disabled via SCRAPER_SCHEDULER_ENABLED=false');
            }

            if (DIGEST_SCHEDULER_ENABLED) {
                console.log(`[digest-scheduler] enabled, interval=${DIGEST_SCHEDULER_INTERVAL_MS}ms`);
                setTimeout(() => {
                    runDigestScheduler();
                }, 15 * 1000);

                setInterval(() => {
                    runDigestScheduler();
                }, DIGEST_SCHEDULER_INTERVAL_MS);
            } else {
                console.log('[digest-scheduler] disabled via DIGEST_SCHEDULER_ENABLED=false');
            }
        });
    } catch (error) {
        console.error('MongoDB connection error:', error.message || error);
        process.exit(1);
    }
};

startServer();