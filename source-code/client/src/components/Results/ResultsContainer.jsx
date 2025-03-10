import './ResultsContainer.css';

export const ResultsContainer = ({ loading, searchResults }) => {
  if (loading) {
    return (
      <div className="results-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Analyzing street network...</p>
        </div>
      </div>
    );
  }

  if (!searchResults || searchResults.length === 0) {
    return null;
  }

  return (
    <div className="results-container">
      {searchResults.map((category, index) => (
        <div key={index} className="category-section">
          <h3>{category.category}</h3>
          <div className="card-grid">
            {category.amenities.map((amenity, amenityIndex) => (
              <div key={amenityIndex} className="amenity-card">
                <div className="card-header">
                  <h4>{amenity.name}</h4>
                  <div className="score-section">
                    <div className="score">{amenity.score}</div>
                  </div>
                </div>
                <div className="amenity-detail">
                  <h5>Location</h5>
                  <div className="location-details">
                    <p className="area-name">
                      <span>{amenity.address}</span>
                    </p>
                    <div className="coordinates">
                      <span>Lat: {amenity.lat.toFixed(6)}</span>
                      <span>Lng: {amenity.lng.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
                <div className="additional-info">
                  <span>Distance: {amenity.distance.toFixed(2)} km</span>
                  <span>Travel Time: {amenity.travelTime} min</span>
                </div>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${amenity.lat},${amenity.lng}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="maps-link primary"
                >
                  View on Google Maps
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}; 