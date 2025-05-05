// API configuration
const isDevelopment = import.meta.env.MODE === 'development';

// Using ngrok for secure HTTPS tunnel to local backend
const LOCAL_API_URL = 'https://e3fd-82-10-48-243.ngrok-free.app';

// This is your deployed backend URL, kept for reference
const REMOTE_API_URL = 'https://tranquilty-backend-core.onrender.com';

// Use local by default
export const API_URL = LOCAL_API_URL;

// Helper function if you need to access both URLs
export const getApiUrl = (useRemote = false) => {
  if (useRemote) return REMOTE_API_URL;
  return LOCAL_API_URL;
}; 