import { useState, useEffect } from "react";
import { MapView } from "../../components/Map/MapView";
import SearchBar from "../../components/SearchBar/SearchBar";
import "./MapViewPage.css";

function MapViewPage() {
  console.log("🗺️ MapViewPage: Component mounting");
  const [city, setCity] = useState("Cardiff, UK");
  const [locations, setLocations] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    console.log("🔄 MapViewPage: Checking for stored search results");
    const storedResults = sessionStorage.getItem("searchResults");
    if (storedResults) {
      try {
        const parsedResults = JSON.parse(storedResults);
        console.log("📥 MapViewPage: Found stored results:", parsedResults);
        setLocations(parsedResults);
        setHasSearched(true);
        setCity(sessionStorage.getItem("searchCity") || "Cardiff, UK");
      } catch (error) {
        console.error("❌ MapViewPage: Error parsing stored results:", error);
      }
    } else {
      console.log("ℹ️ MapViewPage: No stored results found");
    }
  }, []);

  const handleSearchResults = (results) => {
    console.log("🔍 MapViewPage: Received search results:", results);
    setLocations(results);
    setHasSearched(true);
  };

  // Keep the searched city (not the top result's neighbourhood) for the heading and map
  const handleSearchStart = (query) => {
    setCity(query);
    sessionStorage.setItem("searchCity", query);
  };

  console.log("🎨 MapViewPage: Rendering with state:", { city, locationsCount: locations.length, hasSearched });
  return (
    <div className="map-view-page">
      <h1 className="page-title">Map View</h1>
      <p className="page-description">
        Search for a city to view recommended locations based on proximity to amenities.
      </p>
      
      <SearchBar onSearchResults={handleSearchResults} onSearchStart={handleSearchStart} />
      
      {hasSearched && locations.length === 0 ? (
        <div className="no-results">
          <p>No locations found. Try searching for a different city.</p>
        </div>
      ) : (
        <>
          {locations.length > 0 && (
            <div className="results-summary">
              <h2>Showing {locations.length} locations in {city}</h2>
            </div>
          )}
          
          <MapView city={city} locations={locations} />
          
          {locations.length > 0 && (
            <div className="results-list">
              <h2>Top Locations</h2>
              <div className="location-cards">
                {locations.map((location, index) => (
                  <div key={index} className="location-card">
                    <h3>Location {index + 1}</h3>
                    <p className="score">Score: {location.score}/100</p>
                    <p>Area: {location.area_name || "Unknown"}</p>
                    
                    {/* Score Breakdown */}
                    <div className="score-breakdown">
                      <h4>Score Breakdown:</h4>
                      <div className="score-components">
                        <div className="score-component">
                          <span>Travel (40%): {Math.round(location.score_breakdown?.travel || 0)}</span>
                        </div>
                        <div className="score-component">
                          <span>Amenities (40%): {Math.round(location.score_breakdown?.amenities?.total || 0)}</span>
                        </div>
                        <div className="score-component">
                          <span>Transit (20%): {Math.round(location.score_breakdown?.transit?.score || 0)}</span>
                        </div>
                      </div>
                    </div>

                    <h4>Nearby Amenities:</h4>
                    <ul className="amenities-list">
                      {Object.entries(location.amenities || {}).map(([type, amenity]) => (
                        <li key={type}>
                          <span className="amenity-type">{type}:</span> {amenity.name} ({amenity.distance}m)
                          <br />
                          <span className="amenity-score">Score: {amenity.score.toFixed(1)}/{amenity.weight}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Transit Details */}
                    {location.transit && (
                      <div className="transit-detail">
                        <h4>Public Transport</h4>
                        <p>
                          Transit Score: {location.transit.score}/100
                          <br />
                          Accessible Routes: {location.transit.accessible_routes.length}
                        </p>
                      </div>
                    )}

                    <a 
                      href={location.google_maps_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="maps-link"
                    >
                      View on Google Maps
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MapViewPage; 