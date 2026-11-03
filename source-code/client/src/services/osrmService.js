import { API_URL } from '../utils/api';

// Routes come from openrouteservice via the Worker (which holds the API key).
export const getDirections = async (startCoords, endCoords, profile = 'driving-car') => {
  try {
    // Format coordinates as lon,lat (ORS expects longitude first)
    const startPoint = `${startCoords[1]},${startCoords[0]}`; // lon,lat
    const endPoint = `${endCoords[1]},${endCoords[0]}`; // lon,lat

    const url = `${API_URL}/directions?profile=${profile}&start=${startPoint}&end=${endPoint}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching directions:', error);
    throw error;
  }
};
