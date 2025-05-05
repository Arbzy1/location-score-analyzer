import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: '*',  // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add proxy endpoint for postcodes.io
app.get('/api/proxy/postcodes/:postcode', async (req, res) => {
  try {
    const { postcode } = req.params;
    const response = await axios.get(`https://api.postcodes.io/postcodes/${postcode}`);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(error.response?.status || 500).json(error.response?.data || { error: 'Proxy request failed' });
  }
});

// Add health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Use port from environment variable for Render compatibility
const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
}); 