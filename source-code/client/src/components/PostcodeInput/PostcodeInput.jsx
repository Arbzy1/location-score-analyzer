import { useState } from 'react';
import './PostcodeInput.css';

function PostcodeInput({ 
  onPostcodeSubmit, 
  onRemovePostcode,
  savedPostcodes = [],
  onAddLocation, 
  savedLocations = [],
  onRemoveLocation,
  disabled
}) {
  const [postcode, setPostcode] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [locationType, setLocationType] = useState('home');

  // Add console log to debug
  console.log('savedPostcodes in PostcodeInput:', savedPostcodes);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!postcode || !label) {
      setError('Please enter both postcode and label');
      return;
    }

    // Check if label already exists
    if (savedLocations.some(loc => loc.label.toLowerCase() === label.toLowerCase())) {
      setError('This label is already in use');
      return;
    }

    // Basic UK postcode validation
    const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
    if (!postcodeRegex.test(postcode)) {
      setError('Please enter a valid UK postcode');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/postcode/${encodeURIComponent(postcode)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
      }

      const data = await response.json();
      
      if (data.status === 200) {
        const newLocation = {
          id: Date.now().toString(),
          label,
          postcode: data.result.postcode,
          latitude: data.result.latitude,
          longitude: data.result.longitude
        };
        
        console.log('Submitting new location:', newLocation);
        onPostcodeSubmit(newLocation);
        
        setPostcode('');
        setLabel('');
        setSuccess('Location added successfully!');
      } else {
        setError(data.error || 'Invalid postcode');
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Error processing postcode');
    }
  };

  return (
    <div className="postcode-input">
      <div className="input-section">
        <h3>Add New Postcode</h3>
        <form onSubmit={handleSubmit} className="postcode-form">
          <div className="input-group">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Location label (e.g., Home, Office)"
              className="label-field"
            />
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="Enter postcode"
              className="postcode-field"
            />
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              className="location-type-field"
            >
              <option value="home">Home</option>
              <option value="work">Work</option>
              <option value="school">School</option>
              <option value="other">Other</option>
            </select>
            <button type="submit" className="postcode-button">
              Add Location
            </button>
          </div>
          {error && <p className="postcode-error">{error}</p>}
          {success && <p className="postcode-success">{success}</p>}
        </form>
      </div>

      {/* Only render saved postcodes section if savedPostcodes exists and has items */}
      {Array.isArray(savedPostcodes) && savedPostcodes.length > 0 && (
        <div className="saved-postcodes">
          <h3>Saved Postcodes</h3>
          <div className="saved-postcodes-list">
            {savedPostcodes.map(location => (
              <div key={location.id} className="saved-item">
                <span>{location.label} - {location.postcode}</span>
                <button 
                  onClick={() => onRemovePostcode(location.id)}
                  className="remove-button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add similar checks for Saved Locations section */}
      {Array.isArray(savedLocations) && savedLocations.length > 0 && (
        <div className="saved-locations">
          <h3>Saved Locations</h3>
          {savedLocations.map(location => (
            <div key={location.id} className="saved-item">
              <span>{location.label} - {location.postcode}</span>
              <button 
                onClick={() => onRemoveLocation(location.id)}
                className="remove-button"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PostcodeInput; 