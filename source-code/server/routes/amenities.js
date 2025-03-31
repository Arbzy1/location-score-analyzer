// Add new endpoint to get amenities for a postcode location
router.get('/postcode-amenities', async (req, res) => {
  try {
    const { postcode } = req.query;
    
    if (!postcode) {
      return res.status(400).json({ error: 'Postcode is required' });
    }

    // Get coordinates for the postcode
    const coordinates = await getCoordinatesForPostcode(postcode);
    if (!coordinates) {
      return res.status(404).json({ error: 'Postcode not found' });
    }

    // Get amenities using the existing getAmenities function
    const amenities = await getAmenities(coordinates.lat, coordinates.lon);

    res.json(amenities);
  } catch (error) {
    console.error('Error fetching postcode amenities:', error);
    res.status(500).json({ error: 'Failed to fetch amenities' });
  }
}); 