import { useState } from 'react';
import './PostcodeInput.css';

function PostcodeInput({ onPostcodeSubmit, savedLocations }) {
  const [postcode, setPostcode] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [locationType, setLocationType] = useState('home');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!label.trim()) {
      setError('Please enter a label for this location');
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
      const response = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
      const data = await response.json();

      if (data.status === 200) {
        onPostcodeSubmit({
          id: Date.now(),
          label: label,
          type: locationType,
          postcode: data.result.postcode,
          latitude: data.result.latitude,
          longitude: data.result.longitude
        });
        
        // Clear inputs after successful submission
        setPostcode('');
        setLabel('');
        setError('');
      } else {
        setError('Postcode not found');
      }
    } catch (err) {
      setError('Error looking up postcode');
      console.error('Postcode lookup error:', err);
    }
  };

  return (
    <div className="postcode-input">
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
      </form>

      {savedLocations.length > 0 && (
        <div className="saved-locations">
          <h3>Saved Locations:</h3>
          <div className="location-chips">
            {savedLocations.map((location) => (
              <div key={location.id} className="location-chip">
                <span className="location-label">{location.label}</span>
                <span className="location-postcode">{location.postcode}</span>
                <button
                  className="remove-location"
                  onClick={() => onPostcodeSubmit(null, location.id)}
                  aria-label="Remove location"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PostcodeInput; 