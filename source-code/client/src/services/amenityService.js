import { API_URL } from '../utils/api';

export const getPostcodeAmenities = async (postcode) => {
  try {
    const response = await fetch(`${API_URL}/postcode/${encodeURIComponent(postcode)}/amenities`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching postcode amenities:', error);
    throw error;
  }
}; 