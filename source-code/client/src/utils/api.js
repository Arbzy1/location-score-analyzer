// The API is served by the same Cloudflare Worker as the app, so a relative path works
// everywhere. Set VITE_API_URL only to point a local build at a different backend.
export const API_URL = import.meta.env.VITE_API_URL || '/api';

// Simple helper function if needed elsewhere
export const getApiUrl = () => API_URL;
