import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MapView from "../../components/Map/MapView";
import SearchBar from "../../components/SearchBar/SearchBar";
import PostcodeInput from '../../components/PostcodeInput/PostcodeInput';
import "./Home.css";

function Home() {
  console.log("🏠 Home: Component mounting");
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targetPostcode, setTargetPostcode] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);

  const handleSearchStart = (searchQuery) => {
    console.log("🔍 Search started for:", searchQuery);
    setIsLoading(true);
    setHasSearched(true);
    setError(null);
    setSelectedCity(searchQuery);
  };

  const handleSearchResults = (results) => {
    console.log("📊 Received search results in Home:", results);
    setIsLoading(false);
    
    if (!results) {
      console.error("❌ No results received");
      setError("No results received from server");
      setSearchResults([]);
      return;
    }

    if (!Array.isArray(results)) {
      console.error("❌ Results is not an array:", results);
      setError("Invalid response format from server");
      setSearchResults([]);
      return;
    }

    if (results.length === 0) {
      console.log("ℹ️ No results found");
      setSearchResults([]);
      return;
    }

    try {
      console.log("Processing results:", results);
      const processedResults = results.map((location, index) => {
        if (!location) {
          console.error("❌ Invalid location data at index", index);
          return null;
        }

        console.log(`Processing location ${index}:`, location);

        return {
          id: index + 1,
          score: location.score || 0,
          area_name: location.area_name || "Unknown Location",
          amenities: location.amenities || {},
          lat: location.lat || 0,
          lon: location.lon || 0,
          google_maps_link: location.google_maps_link || 
            `https://www.google.com/maps?q=${location.lat},${location.lon}`,
          category: location.category || "Recommended Location",
          name: location.name || `Location ${index + 1}`,
          reason: location.reason || ""
        };
      }).filter(Boolean);

      console.log("✅ Processed results:", processedResults);
      
      if (processedResults.length > 0) {
        console.log("Setting search results:", processedResults);
        setSearchResults(processedResults);
        setSelectedCity(processedResults[0].area_name);
        setError(null);
      } else {
        setSearchResults([]);
        setError("No valid locations found in the response");
      }
    } catch (err) {
      console.error("❌ Error processing results:", err);
      setError("Error processing search results");
      setSearchResults([]);
    }
  };

  const handlePostcodeSubmit = (newLocation, locationIdToRemove) => {
    if (locationIdToRemove) {
      setSavedLocations(prev => prev.filter(loc => loc.id !== locationIdToRemove));
    } else if (newLocation) {
      setSavedLocations(prev => [...prev, newLocation]);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log("Current state:", {
      resultsCount: searchResults.length,
      hasSearched,
      selectedCity,
      isLoading,
      error
    });
  }, [searchResults, hasSearched, selectedCity, isLoading, error]);

  console.log("🎨 Home: Rendering content");
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1 className="hero-title">Find the Best Locations</h1>
        <p className="hero-subtitle">
          Discover optimal locations based on proximity to schools, hospitals, and supermarkets
        </p>
        
        <div className="search-container">
          <SearchBar 
            onSearchResults={handleSearchResults}
            onSearchStart={handleSearchStart}
          />
          <PostcodeInput 
            onPostcodeSubmit={handlePostcodeSubmit}
            savedLocations={savedLocations}
          />
        </div>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <p>Analyzing locations in {selectedCity}...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {hasSearched && !isLoading && !error && (
        <div className="map-section">
          <div className="map-container">
            <MapView 
              city={selectedCity} 
              locations={searchResults}
              savedLocations={savedLocations}
            />
          </div>

          {searchResults.length === 0 ? (
            <div className="no-results">
              <p>No locations found for {selectedCity}. Try searching for a different city.</p>
            </div>
          ) : (
            <div className="results-section">
              <h2>Top {searchResults.length} Locations in {selectedCity}</h2>
              <div className="location-cards">
                {searchResults.map((location, index) => (
                  <div key={index} className="location-card">
                    <h3>Location {index + 1}</h3>
                    <p className="score">Score: {location.score}/100</p>
                    <p>Area: {location.area_name}</p>
                    {Object.keys(location.amenities).length > 0 && (
                      <>
                        <h4>Nearby Amenities:</h4>
                        <ul className="amenities-list">
                          {Object.entries(location.amenities).map(([type, amenity]) => (
                            <li key={type}>
                              <span className="amenity-type">{type}:</span>
                              {amenity.name} ({amenity.distance}m)
                            </li>
                          ))}
                        </ul>
                      </>
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
        </div>
      )}

      <div className="features-section">
        <h2 className="section-title">How It Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Search</h3>
            <p>Enter a city name to analyze potential locations</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Analyze</h3>
            <p>Our algorithm evaluates locations based on amenity proximity</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🗺️</div>
            <h3>Visualize</h3>
            <p>View results on an interactive map with detailed information</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Compare</h3>
            <p>Compare different locations to find the best match for your needs</p>
          </div>
        </div>
      </div>
      
      {searchResults.length > 0 && (
        <div className="cta-section">
          <h2>Want to see more details?</h2>
          <p>Check out our full-screen map view for an enhanced experience</p>
          <button 
            onClick={() => {
              console.log("🖱️ Home: Map exploration button clicked");
              // Store current results before navigating
              sessionStorage.setItem("searchResults", JSON.stringify(searchResults));
              navigate("/map");
            }} 
            className="cta-button"
          >
            Open Full Map View
          </button>
        </div>
      )}
    </div>
  );
}

export default Home; 