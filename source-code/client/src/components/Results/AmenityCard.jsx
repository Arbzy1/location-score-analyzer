export function AmenityCard({ item, index }) {
  return (
    <div className="amenity-card">
      <div className="card-header">
        <h4>Location {index + 1}</h4>
        <div className="area-name">
          <span>Area: {item.area_name}</span>
        </div>
      </div>
      
      <div className="card-content">
        <div className="score-section">
          <span className="score">Score: {item.score}/100</span>
        </div>

        {item.reason && <p className="reason">{item.reason}</p>}
        
        <div className="location-details">
          <p className="coordinates">
            <span>📍 Location:</span>
            <br />
            Lat: {item.lat.toFixed(4)}
            <br />
            Lon: {item.lon.toFixed(4)}
          </p>
          
          <a 
            href={item.google_maps_link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="maps-link primary"
          >
            View Location on Maps 🗺️
          </a>
        </div>

        {/* Amenities Section */}
        {item.amenities && Object.entries(item.amenities).map(([type, amenity]) => (
          <div key={type} className="amenity-detail">
            <h5>{type.charAt(0).toUpperCase() + type.slice(1)}</h5>
            <p>
              <strong>{amenity.name}</strong>
              <br />
              Distance: {amenity.distance}m
            </p>
            <a 
              href={`https://www.google.com/maps?q=${amenity.lat},${amenity.lon}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="maps-link secondary"
            >
              View {type} on Maps 🏢
            </a>
          </div>
        ))}
      </div>
    </div>
  );
} 