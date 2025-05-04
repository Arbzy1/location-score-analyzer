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
  const [travelMode, setTravelMode] = useState('auto');
  const [showTravelModeTips, setShowTravelModeTips] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState('both'); // 'primary', 'secondary', or 'both'

  // Load saved preferences if they exist
  useEffect(() => {
    if (savedPreferences) {
      if (Array.isArray(savedPreferences)) {
        const processedLocations = savedPreferences.map(loc => ({
          ...loc,
          type: loc.type || 'Home'
        }));
        setLocations(processedLocations);
      } else {
        const processedLocations = (savedPreferences.locations || []).map(loc => ({
          ...loc,
          type: loc.type || 'Home'
        }));
        setLocations(processedLocations);
        if (savedPreferences.amenityWeights) {
          setAmenityWeights(savedPreferences.amenityWeights);
        }
        if (savedPreferences.travelMode) {
          setTravelMode(savedPreferences.travelMode);
        }
        if (savedPreferences.schoolFilter) {
          setSchoolFilter(savedPreferences.schoolFilter);
        }
      }
    }
  }, [savedPreferences]);

  const totalWeight = Object.values(amenityWeights).reduce((sum, weight) => sum + weight, 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    const validLocations = locations.filter(loc => loc.postcode && loc.type && loc.frequency);
    
    // Prepare the data object with all preferences
    const preferencesData = {
      locations: validLocations,
      amenityWeights,
      travelMode,
      schoolFilter
    };
    
    // Log preferences to help with debugging
    console.log("Submitting travel preferences:", preferencesData);
    console.log("School filter selected:", schoolFilter);
    
    // Submit to parent component
    onSubmit(preferencesData);
  };

  const addLocation = () => {
    setLocations([...locations, { 
      postcode: '', 
      type: 'Home', 
      frequency: 1,
      travelMode: 'auto'
    }]);
  };

  const removeLocation = (index) => {
    const newLocations = [...locations];
    newLocations.splice(index, 1);
    setLocations(newLocations);
  };

  const updateLocation = (index, field, value) => {
    const newLocations = [...locations];
    newLocations[index] = { ...newLocations[index], [field]: value };
    setLocations(newLocations);
  };

  const updateWeight = (amenity, value) => {
    setAmenityWeights({
      ...amenityWeights,
      [amenity]: parseInt(value, 10)
    });
  };

  return (
    <div className="travel-behaviour-form">
      <h2>Travel Preferences</h2>
      
      {/* Travel Mode Section */}
      <div className="travel-mode-section">
        <h3>Travel Mode Preferences</h3>
        <div className="travel-mode-options">
          <label>
            <input
              type="radio"
              name="travelMode"
              value="auto"
              checked={travelMode === 'auto'}
              onChange={(e) => setTravelMode(e.target.value)}
            />
            Auto-select fastest mode
          </label>
          <label>
            <input
              type="radio"
              name="travelMode"
              value="driving"
              checked={travelMode === 'driving'}
              onChange={(e) => setTravelMode(e.target.value)}
            />
            Always use driving
          </label>
          <label>
            <input
              type="radio"
              name="travelMode"
              value="cycling"
              checked={travelMode === 'cycling'}
              onChange={(e) => setTravelMode(e.target.value)}
            />
            Always use cycling
          </label>
          <label>
            <input
              type="radio"
              name="travelMode"
              value="walking"
              checked={travelMode === 'walking'}
              onChange={(e) => setTravelMode(e.target.value)}
            />
            Always use walking
          </label>
          <label>
            <input
              type="radio"
              name="travelMode"
              value="bus"
              checked={travelMode === 'bus'}
              onChange={(e) => setTravelMode(e.target.value)}
            />
            Always use bus transit
          </label>
        </div>
        
        <button 
          type="button" 
          className="tips-toggle"
          onClick={() => setShowTravelModeTips(!showTravelModeTips)}
        >
          {showTravelModeTips ? 'Hide Travel Mode Tips' : 'Show Travel Mode Tips'}
        </button>
        
        {showTravelModeTips && (
          <div className="travel-mode-tips">
            <h4>About Travel Modes</h4>
            <ul>
              <li><strong>Auto-select:</strong> We'll calculate routes for all modes and choose the fastest one</li>
              <li><strong>Driving:</strong> Only consider car routes (good if you always drive)</li>
              <li><strong>Cycling:</strong> Only consider bike routes (good if you prefer cycling)</li>
              <li><strong>Walking:</strong> Only consider walking routes (good for short distances)</li>
              <li><strong>Bus transit:</strong> Only consider public transport + walking routes (environmentally friendly)</li>
            </ul>
          </div>
        )}
      </div>

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
        
        {/* School Type Filter */}
        {amenityWeights.school > 0 && (
          <div className="school-filter-section">
            <h4>School Type Preference</h4>
            <div className="school-filter-options">
              <label>
                <input
                  type="radio"
                  name="schoolFilter"
                  value="both"
                  checked={schoolFilter === 'both'}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                />
                Both Primary and Secondary Schools
              </label>
              <label>
                <input
                  type="radio"
                  name="schoolFilter"
                  value="primary"
                  checked={schoolFilter === 'primary'}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                />
                Primary Schools Only
              </label>
              <label>
                <input
                  type="radio"
                  name="schoolFilter"
                  value="secondary"
                  checked={schoolFilter === 'secondary'}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                />
                Secondary Schools Only
              </label>
            </div>
            <p className="school-filter-note">
              Choose which types of schools are most important for your search.
            </p>
          </div>
        )}
        
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
          <div key={index} className="location-row">
            <div className="location-details">
              <input
                type="text"
                placeholder="Postcode"
                value={location.postcode}
                onChange={(e) => updateLocation(index, 'postcode', e.target.value)}
                className="postcode-input"
              />
              <select
                value={location.type}
                onChange={(e) => updateLocation(index, 'type', e.target.value)}
                className="location-type"
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
                className="frequency-input"
              />
              <select
                value={location.travelMode || 'auto'}
                onChange={(e) => updateLocation(index, 'travelMode', e.target.value)}
                className="mode-select"
              >
                <option value="auto">Auto (Fastest)</option>
                <option value="walking">Walking</option>
                <option value="cycling">Cycling</option>
                <option value="driving">Driving</option>
                <option value="bus">Bus Transit</option>
              </select>
              <button 
                type="button" 
                className="remove-btn"
                onClick={() => removeLocation(index)}
              >
                Remove
              </button>
            </div>
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