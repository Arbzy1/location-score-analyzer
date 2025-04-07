import React, { useState, useEffect } from 'react';
import './TravelBehaviourForm.css';

export const TravelBehaviourForm = ({ onSubmit, savedPreferences }) => {
  // Initialize state with default values
  const [locations, setLocations] = useState([]);
  const [amenityWeights, setAmenityWeights] = useState({
    school: 15,
    hospital: 15,
    supermarket: 10
  });
  const [showTips, setShowTips] = useState(false);

  // Load saved preferences if they exist
  useEffect(() => {
    if (savedPreferences) {
      console.log("🔍 DEBUG: Loading saved preferences in TravelBehaviourForm:", JSON.stringify(savedPreferences, null, 2));
      
      // Handle both old format (array) and new format (object with locations and weights)
      if (Array.isArray(savedPreferences)) {
        // Ensure each location has a valid type
        const processedLocations = savedPreferences.map(loc => {
          console.log("🔍 DEBUG: Processing location:", JSON.stringify(loc, null, 2));
          // Ensure type is properly set with a default if missing
          const type = loc.type || 'Home';
          return {
            ...loc,
            type: type  // Use the validated type
          };
        });
        console.log("🔍 DEBUG: Processed locations:", JSON.stringify(processedLocations, null, 2));
        setLocations(processedLocations);
      } else {
        // Ensure each location has a valid type
        const processedLocations = (savedPreferences.locations || []).map(loc => {
          console.log("🔍 DEBUG: Processing location:", JSON.stringify(loc, null, 2));
          // Ensure type is properly set with a default if missing
          const type = loc.type || 'Home';
          return {
            ...loc,
            type: type  // Use the validated type
          };
        });
        console.log("🔍 DEBUG: Processed locations:", JSON.stringify(processedLocations, null, 2));
        setLocations(processedLocations);
        if (savedPreferences.amenityWeights) {
          setAmenityWeights(savedPreferences.amenityWeights);
        }
      }
    }
  }, [savedPreferences]);

  // Calculate total weight
  const totalWeight = Object.values(amenityWeights).reduce((sum, weight) => sum + weight, 0);

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    // Filter out empty locations
    const validLocations = locations.filter(loc => loc.postcode && loc.type && loc.frequency);
    onSubmit({
      locations: validLocations,
      amenityWeights
    });
  };

  // Add a new location
  const addLocation = () => {
    setLocations([...locations, { postcode: '', type: 'Home', frequency: 1 }]);
  };

  // Remove a location
  const removeLocation = (index) => {
    const newLocations = [...locations];
    newLocations.splice(index, 1);
    setLocations(newLocations);
  };

  // Update a location
  const updateLocation = (index, field, value) => {
    const newLocations = [...locations];
    newLocations[index] = { ...newLocations[index], [field]: value };
    setLocations(newLocations);
  };

  // Update amenity weight
  const updateWeight = (amenity, value) => {
    setAmenityWeights({
      ...amenityWeights,
      [amenity]: parseInt(value, 10)
    });
  };

  return (
    <div className="travel-behaviour-form">
      <h2>Travel Preferences</h2>
      
      {/* Amenity Weights Section */}
      <div className="amenity-weights-section">
        <h3>Set Amenity Importance</h3>
        <p>Adjust the importance of each amenity type (total: {totalWeight}%)</p>
        
        <div className="weight-sliders">
          <div className="weight-slider-group">
            <label>Schools: {amenityWeights.school}%</label>
            <input
              type="range"
              min="0"
              max="30"
              value={amenityWeights.school}
              onChange={(e) => updateWeight('school', e.target.value)}
            />
          </div>
          
          <div className="weight-slider-group">
            <label>Hospitals: {amenityWeights.hospital}%</label>
            <input
              type="range"
              min="0"
              max="30"
              value={amenityWeights.hospital}
              onChange={(e) => updateWeight('hospital', e.target.value)}
            />
          </div>
          
          <div className="weight-slider-group">
            <label>Supermarkets: {amenityWeights.supermarket}%</label>
            <input
              type="range"
              min="0"
              max="30"
              value={amenityWeights.supermarket}
              onChange={(e) => updateWeight('supermarket', e.target.value)}
            />
          </div>
        </div>
        
        <div className="total-weight">
          Total Weight: {totalWeight}%
          {totalWeight !== 40 && (
            <span className="weight-warning">
              Note: Total should be 40% for optimal results
            </span>
          )}
        </div>
        
        <button 
          type="button" 
          className="tips-toggle"
          onClick={() => setShowTips(!showTips)}
        >
          {showTips ? 'Hide Tips' : 'Show Tips'}
        </button>
        
        {showTips && (
          <div className="weight-tips">
            <h4>How Weights Work</h4>
            <ul>
              <li>Higher weights mean the amenity has more impact on the final score</li>
              <li>Total weight should be 40% (the remaining 60% is split between transit and travel time)</li>
              <li>Set weights to 0 for amenities you don't care about</li>
              <li>Adjust weights based on your lifestyle and priorities</li>
            </ul>
          </div>
        )}
      </div>
      
      {/* Locations Section */}
      <div className="locations-section">
        <h3>Frequent Destinations</h3>
        <p>Add locations you visit regularly</p>
        
        {locations.map((location, index) => (
          <div key={index} className="location-input">
            <input
              type="text"
              placeholder="Postcode"
              value={location.postcode}
              onChange={(e) => updateLocation(index, 'postcode', e.target.value)}
            />
            <select
              value={location.type}
              onChange={(e) => updateLocation(index, 'type', e.target.value)}
            >
              <option value="Home">Home</option>
              <option value="Work">Work</option>
              <option value="School">School</option>
              <option value="Other">Other</option>
            </select>
            <input
              type="number"
              min="1"
              max="7"
              placeholder="Times per week"
              value={location.frequency}
              onChange={(e) => updateLocation(index, 'frequency', parseInt(e.target.value, 10))}
            />
            <button 
              type="button" 
              className="remove-location"
              onClick={() => removeLocation(index)}
            >
              Remove
            </button>
          </div>
        ))}
        
        <button 
          type="button" 
          className="add-location"
          onClick={addLocation}
        >
          Add Location
        </button>
      </div>
      
      <button 
        type="button" 
        className="submit-preferences"
        onClick={handleSubmit}
      >
        Save Preferences
      </button>
    </div>
  );
}; 