// API configuration
const isDevelopment = import.meta.env.MODE === 'development';

// Using the public IP address for the backend with HTTP instead of HTTPS
const LOCAL_API_URL = 'http://82.10.48.243:5000';

// This is your deployed backend URL, kept for reference
const REMOTE_API_URL = 'https://tranquilty-backend-core.onrender.com';

// Use local by default
export const API_URL = LOCAL_API_URL;

// Helper function if you need to access both URLs
export const getApiUrl = (useRemote = false) => {
  if (useRemote) return REMOTE_API_URL;
  return LOCAL_API_URL;
}; 