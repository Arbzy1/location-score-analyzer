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
          
          {/* Score Breakdown */}
          <div className="score-breakdown">
            <div className="score-component">
              <span>Travel (40%): {Math.round(item.score_breakdown?.travel || 0)}</span>
            </div>
            <div className="score-component">
              <span>Amenities (40%): {Math.round(item.score_breakdown?.amenities?.total || 0)}</span>
            </div>
            <div className="score-component">
              <span>Transit (20%): {Math.round(item.score_breakdown?.transit?.score || 0)}</span>
            </div>
          </div>
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
              {type === "school" && amenity.is_top_rated && (
                <span className={`badge top-school-badge ${amenity.school_type || 'unknown'}-school`}>
                  {amenity.school_type === "primary" ? '🏫' : '🎓'} 
                  {amenity.rank <= 3 ? '🥇' : amenity.rank <= 10 ? '🥈' : '🌟'} 
                  Rank {amenity.rank} {amenity.school_type === "primary" ? "Primary" : "Secondary"} School
                </span>
              )}
              <br />
              Distance: {amenity.distance}m
              <br />
              Score: {amenity.score.toFixed(1)}/{amenity.weight}
              {type === "school" && amenity.is_top_rated && (
                <>
                  <br />
                  <span className="rating-text">Estyn Rating: {amenity.rating}</span>
                </>
              )}
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

        {/* Transit Details */}
        {item.transit && (
          <div className="transit-detail">
            <h5>Public Transport</h5>
            <p>
              Transit Score: {item.transit.score}/100
              <br />
              Accessible Routes: {item.transit.accessible_routes.length}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 