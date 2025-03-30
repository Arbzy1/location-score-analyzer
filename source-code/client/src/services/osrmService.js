const OSRM_BASE_URL = 'http://192.168.1.162:8080/ors/v2';

// Function to get nearest routable point
const getNearestPoint = async (coords) => {
  try {
    const url = `${OSRM_BASE_URL}/nearest?point=${coords[0]},${coords[1]}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    // Return the coordinates of the nearest point
    return [data.coordinates[1], data.coordinates[0]]; // [lat, lon]
  } catch (error) {
    console.error('Error finding nearest point:', error);
    throw error;
  }
};

export const getDirections = async (startCoords, endCoords) => {
  try {
    // Format coordinates as lon,lat (OSRM expects longitude first)
    const startPoint = `${startCoords[1]},${startCoords[0]}`; // lon,lat
    const endPoint = `${endCoords[1]},${endCoords[0]}`; // lon,lat
    
    const url = `${OSRM_BASE_URL}/directions/driving-car?start=${startPoint}&end=${endPoint}`;
    console.log('Requesting route from URL:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('OSRM response:', data);
    return data;
  } catch (error) {
    console.error('Error fetching directions:', error);
    throw error;
  }
}; 