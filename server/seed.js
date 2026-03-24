const mongoose = require('mongoose');
const { runScraperAndUpsert } = require('./utils/scraper');
require('dotenv').config();

const runSeed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hackathon-2026");
    console.log("Connected to MongoDB...");

    const result = await runScraperAndUpsert();
    console.log("Seed completed:", result);

  } catch (err) {
    console.error("Seed failed:", err);
  } finally {
    mongoose.connection.close();
    console.log("Database connection closed.");
  }
};

runSeed();