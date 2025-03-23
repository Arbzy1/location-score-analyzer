import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MapView from "../../components/Map/MapView";
import SearchBar from "../../components/SearchBar/SearchBar";
import PostcodeInput from '../../components/PostcodeInput/PostcodeInput';
import "./Home.css";
import { auth, db } from "../../firebase";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  updateDoc,
  arrayUnion,
  arrayRemove 
} from 'firebase/firestore';
import { useAuth } from "../../contexts/AuthContext";

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
  const { currentUser } = useAuth();
  const [savedPostcodes, setSavedPostcodes] = useState([]);

  // Load saved data when user logs in
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) {
        console.log('No user logged in during load');
        return;
      }
      
      try {
        console.log('Loading data for user:', currentUser.uid);
        const userDoc = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDoc);
        
        if (docSnap.exists()) {
          const userData = docSnap.data();
          console.log('Loaded user data:', userData);
          setSavedLocations(userData.savedLocations || []);
          setSavedPostcodes(userData.savedPostcodes || []);
        } else {
          console.log('Creating new user document');
          await setDoc(userDoc, { 
            savedLocations: [],
            savedPostcodes: [],
            createdAt: new Date().toISOString(),
            email: currentUser.email
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [currentUser]);

  // Handle adding a new postcode
  const handlePostcodeSubmit = async (postcodeData) => {
    if (!currentUser) {
      alert('Please log in to save postcodes');
      return;
    }

    try {
      console.log('Saving postcode for user:', currentUser.uid);
      const userDoc = doc(db, 'users', currentUser.uid);
      const newPostcode = {
        ...postcodeData,
        timestamp: new Date().toISOString()
      };

      // Update the document
      await updateDoc(userDoc, {
        savedPostcodes: arrayUnion(newPostcode)
      });

      // Update local state
      setSavedPostcodes(prev => [...prev, newPostcode]);
      
      // Log success
      console.log('Postcode saved successfully');
    } catch (error) {
      console.error('Error saving postcode:', error);
      alert('Error saving postcode. Please try again.');
    }
  };

  // Handle removing a postcode
  const handleRemovePostcode = async (postcodeId) => {
    if (!currentUser) return;

    try {
      const postcodeToRemove = savedPostcodes.find(pc => pc.id === postcodeId);
      const userDoc = doc(db, 'users', currentUser.uid);
      
      await updateDoc(userDoc, {
        savedPostcodes: arrayRemove(postcodeToRemove)
      });

      setSavedPostcodes(prev => prev.filter(pc => pc.id !== postcodeId));
    } catch (error) {
      console.error('Error removing postcode:', error);
    }
  };

  // Update when adding a new location
  const handleAddLocation = async (newLocation) => {
    if (!currentUser) {
      alert('Please log in to save locations');
      return;
    }

    try {
      const userDoc = doc(db, 'users', currentUser.uid);
      const locationWithId = {
        ...newLocation,
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
      };

      await updateDoc(userDoc, {
        savedLocations: arrayUnion(locationWithId)
      });

      setSavedLocations(prev => [...prev, locationWithId]);
    } catch (error) {
      console.error('Error saving location:', error);
    }
  };

  // Remove a saved location
  const handleRemoveLocation = async (locationId) => {
    if (!currentUser) return;

    try {
      const locationToRemove = savedLocations.find(loc => loc.id === locationId);
      const userDoc = doc(db, 'users', currentUser.uid);
      
      await updateDoc(userDoc, {
        savedLocations: arrayRemove(locationToRemove)
      });

      setSavedLocations(prev => prev.filter(loc => loc.id !== locationId));
    } catch (error) {
      console.error('Error removing location:', error);
    }
  };

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
            onRemovePostcode={handleRemovePostcode}
            savedPostcodes={savedPostcodes}
            onAddLocation={handleAddLocation} 
            savedLocations={savedLocations}
            onRemoveLocation={handleRemoveLocation}
            disabled={!currentUser}
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
              savedPostcodes={savedPostcodes}
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