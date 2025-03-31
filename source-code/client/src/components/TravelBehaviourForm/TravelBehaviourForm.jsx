import React, { useState, useEffect } from 'react';
import './TravelBehaviourForm.css';

export const TravelBehaviourForm = ({ onSubmit, savedPreferences }) => {
  const [locations, setLocations] = useState([
    { type: 'work', postcode: '', frequency: 5, transportMode: 'bus' }
  ]);
  const [showForm, setShowForm] = useState(false);

  // Load saved preferences when component mounts or when savedPreferences changes
  useEffect(() => {
    if (savedPreferences && savedPreferences.length > 0) {
      setLocations(savedPreferences);
      console.log("Loaded saved preferences:", savedPreferences);
    }
  }, [savedPreferences]);

  const locationTypes = [
    { value: 'work', label: 'Workplace' },
    { value: 'school', label: 'School/University' },
    { value: 'gym', label: 'Gym/Sports' },
    { value: 'shopping', label: 'Shopping Center' },
    { value: 'leisure', label: 'Leisure/Entertainment' },
    { value: 'family', label: 'Family/Friends' },
    { value: 'other', label: 'Other' }
  ];

  const transportModes = [
    { value: 'bus', label: 'Bus' },
    { value: 'car', label: 'Car' },
    { value: 'walk', label: 'Walking' },
    { value: 'cycle', label: 'Cycling' }
  ];

  const handleAddLocation = () => {
    setLocations([
      ...locations,
      { type: 'work', postcode: '', frequency: 5, transportMode: 'bus' }
    ]);
  };

  const handleRemoveLocation = (index) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const handleLocationChange = (index, field, value) => {
    const newLocations = [...locations];
    newLocations[index][field] = value;
    setLocations(newLocations);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Filter out empty postcodes before submitting
    const validLocations = locations.filter(loc => loc.postcode.trim() !== '');
    if (validLocations.length > 0) {
      onSubmit(validLocations);
      console.log("Submitting travel preferences:", validLocations);
    }
  };

  return (
    <div className="travel-behaviour-form">
      <button 
        className="toggle-form-btn"
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? 'Hide Travel Preferences' : 'Add Travel Preferences'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit}>
          <div className="form-description">
            <h3>Travel Preferences</h3>
            <p>Add locations you frequently visit to help us find the best area for you.</p>
          </div>

          {locations.map((location, index) => (
            <div key={index} className="location-entry">
              <div className="location-header">
                <h4>Location {index + 1}</h4>
                {locations.length > 1 && (
                  <button 
                    type="button" 
                    className="remove-btn"
                    onClick={() => handleRemoveLocation(index)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Location Type</label>
                  <select
                    value={location.type}
                    onChange={(e) => handleLocationChange(index, 'type', e.target.value)}
                  >
                    {locationTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Postcode</label>
                  <input
                    type="text"
                    value={location.postcode}
                    onChange={(e) => handleLocationChange(index, 'postcode', e.target.value)}
                    placeholder="Enter postcode"
                  />
                </div>

                <div className="form-group">
                  <label>Visits per Week</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={location.frequency}
                    onChange={(e) => handleLocationChange(index, 'frequency', parseInt(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Transport Mode</label>
                  <select
                    value={location.transportMode}
                    onChange={(e) => handleLocationChange(index, 'transportMode', e.target.value)}
                  >
                    {transportModes.map(mode => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          <div className="form-actions">
            <button 
              type="button" 
              className="add-location-btn"
              onClick={handleAddLocation}
            >
              Add Another Location
            </button>
            <button type="submit" className="submit-btn">
              Update Preferences
            </button>
          </div>
        </form>
      )}
    </div>
  );
}; 