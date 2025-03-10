import { useState, useEffect } from "react";
import MapView from "../../MapView.jsx";
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
        
        if (parsedResults.length > 0 && parsedResults[0].area_name) {
          setCity(parsedResults[0].area_name);
        }
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
    
    if (results && results.length > 0 && results[0].area_name) {
      console.log("📍 MapViewPage: Updating city to:", results[0].area_name);
      setCity(results[0].area_name);
    }
  };

  console.log("🎨 MapViewPage: Rendering with state:", { city, locationsCount: locations.length, hasSearched });
  return (
    <div className="map-view-page">
      <h1 className="page-title">Map View</h1>
      <p className="page-description">
        Search for a city to view recommended locations based on proximity to amenities.
      </p>
      
      <SearchBar onSearchResults={handleSearchResults} />
      
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
          
          <MapView city={city} />
          
          {locations.length > 0 && (
            <div className="results-list">
              <h2>Top Locations</h2>
              <div className="location-cards">
                {locations.map((location, index) => (
                  <div key={index} className="location-card">
                    <h3>Location {index + 1}</h3>
                    <p className="score">Score: {location.score}/100</p>
                    <p>Area: {location.area_name || "Unknown"}</p>
                    <h4>Nearby Amenities:</h4>
                    <ul className="amenities-list">
                      {Object.entries(location.amenities || {}).map(([type, amenity]) => (
                        <li key={type}>
                          <span className="amenity-type">{type}:</span> {amenity.name} ({amenity.distance}m)
                        </li>
                      ))}
                    </ul>
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