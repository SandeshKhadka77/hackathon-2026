const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors()); // Allows  React app to talk to this server
app.use(express.json());

// 1. Connection URL 
const MONGO_URI = "mongodb://127.0.0.1:27017/hackathon_db"; 

// 2. Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log(" MongoDB Connected Successfully"))
    .catch((err) => console.error(" MongoDB Connection Error:", err));

// 3. Health Check API Route
app.get('/api/status', (req, res) => {
    res.json({ 
        status: "Online", 
        message: "Backend is successfully connected to React!",
        db_status: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
    });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(` Server is running on http://localhost:${PORT}`);
});