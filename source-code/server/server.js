const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const FLASK_API_URL = "http://127.0.0.1:5000"; // Flask backend

app.get("/api/amenities", async (req, res) => {
  try {
    const { city } = req.query;
    const response = await axios.get(`${FLASK_API_URL}/get_amenities?city=${city}`);
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching amenities:", error);
    res.status(500).json({ error: "Failed to fetch amenities" });
  }
});

app.post("/api/save_search", async (req, res) => {
  console.log("Search saved:", req.body);
  res.json({ message: "Search saved successfully!" });
});

app.listen(process.env.PORT || 5001, () => {
  console.log(`Node.js Server running on port ${process.env.PORT || 5001}`);
});
