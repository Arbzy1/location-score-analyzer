const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const FLASK_API_URL = "http://127.0.0.1:5000"; // Ensure Flask is running on this port

// 🏙️ API Endpoint to fetch amenities from Flask
app.get("/api/amenities", async (req, res) => {
    const { city } = req.query;

    if (!city) {
        return res.status(400).json({ error: "City parameter is required" });
    }

    try {
        const response = await axios.get(`${FLASK_API_URL}/amenities?city=${city}`);
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching data from Flask:", error.message);
        res.status(500).json({ error: "Failed to fetch amenities from Flask" });
    }
});

// 📝 Save search results (if using Firebase later)
app.post("/api/save_search", async (req, res) => {
    const { user, search } = req.body;

    if (!user || !search) {
        return res.status(400).json({ error: "User email and search query are required" });
    }

    res.json({ message: "Search saved successfully!" });
});

// Start Node.js Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🚀 Node.js server running on http://localhost:${PORT}`);
});
