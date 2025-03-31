export const getPostcodeAmenities = async (postcode) => {
  try {
    const response = await fetch(`http://localhost:5000/amenities/postcode-amenities?postcode=${encodeURIComponent(postcode)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching postcode amenities:', error);
    throw error;
  }
}; 