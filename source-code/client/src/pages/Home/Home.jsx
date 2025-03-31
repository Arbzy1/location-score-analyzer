import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css';
import { MapView } from '../../components/Map/MapView';
import { TravelBehaviourForm } from '../../components/TravelBehaviourForm/TravelBehaviourForm';
import { auth, db } from "../../firebase";
import { 
  doc, 
  setDoc, 
  getDoc, 
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
  const { currentUser } = useAuth();
  const [savedPostcodes, setSavedPostcodes] = useState([]);
  const [travelPreferences, setTravelPreferences] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [postcode, setPostcode] = useState("");
  const [locationType, setLocationType] = useState("Home");

  console.log('savedPostcodes in Home:', savedPostcodes);

  // Load saved data when user logs in
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) {
        console.log('No user logged in during load');
        setSavedPostcodes([]); // Clear saved postcodes
        setTravelPreferences(null); // Clear travel preferences
        return;
      }
      
      try {
        console.log('Loading data for user:', currentUser.uid);
        const userDoc = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDoc);
        
        if (docSnap.exists()) {
          const userData = docSnap.data();
          console.log('Loaded user data:', userData);
          setSavedPostcodes(userData.savedPostcodes || []);
          // Load saved travel preferences
          if (userData.travelPreferences) {
            console.log('Loading travel preferences:', userData.travelPreferences);
            setTravelPreferences(userData.travelPreferences);
          }
        } else {
          console.log('Creating new user document');
          await setDoc(userDoc, { 
            savedPostcodes: [],
            travelPreferences: null,
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
  const handlePostcodeSubmit = async () => {
    if (!currentUser) {
      alert('Please log in to save postcodes');
      return;
    }

    if (!locationLabel || !postcode) {
      alert('Please enter both a label and postcode');
      return;
    }

    try {
      console.log('Geocoding postcode:', postcode);
      // First, geocode the postcode
      const response = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error('Invalid postcode');
      }

      const { latitude, longitude } = data.result;
      
      console.log('Saving postcode for user:', currentUser.uid);
      const userDoc = doc(db, 'users', currentUser.uid);
      const newPostcode = {
        id: Date.now().toString(),
        label: locationLabel,
        postcode: postcode,
        type: locationType,
        lat: latitude,
        lng: longitude,
        timestamp: new Date().toISOString()
      };

      await updateDoc(userDoc, {
        savedPostcodes: arrayUnion(newPostcode)
      });

      setSavedPostcodes(prev => [...prev, newPostcode]);
      setLocationLabel("");
      setPostcode("");
      setLocationType("Home");
      console.log('Postcode saved successfully');
    } catch (error) {
      console.error('Error saving postcode:', error);
      alert(error.message || 'Error saving postcode. Please try again.');
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

  const handleSearch = async () => {
    if (!selectedCity) {
      setError("Please enter a city name");
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // Make API call without requiring travel preferences
      const response = await axios.get(`http://localhost:5000/amenities`, {
        params: {
          city: selectedCity,
          ...(travelPreferences && { travel_preferences: travelPreferences })
        }
      });

      if (response.data && response.data.locations) {
        processResults(response.data.locations);
      } else {
        setError("No results found");
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Error during search:", err);
      setError(err.response?.data?.message || "An error occurred during search");
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTravelPreferences = async (preferences) => {
    console.log("Updating travel preferences:", preferences);
    
    try {
      // Geocode all postcodes using the same implementation as handlePostcodeSubmit
      const geocodedPreferences = await Promise.all(
        preferences.map(async (pref) => {
          if (!pref.postcode) return null;
          
          const response = await fetch(`https://api.postcodes.io/postcodes/${pref.postcode}`);
          const data = await response.json();
          
          if (!response.ok) {
            console.error(`Failed to geocode postcode ${pref.postcode}`);
            return null;
          }

          const { latitude, longitude } = data.result;
          
          return {
            ...pref,
            lat: latitude,
            lng: longitude,
            timestamp: new Date().toISOString()
          };
        })
      );

      // Filter out null results
      const validGeocoded = geocodedPreferences.filter(pref => pref !== null);

      // Save preferences to state
      setTravelPreferences(validGeocoded);

      // Save preferences to Firebase if user is logged in
      if (currentUser) {
        try {
          console.log("Saving travel preferences to Firebase for user:", currentUser.uid);
          const userDoc = doc(db, 'users', currentUser.uid);
          await updateDoc(userDoc, {
            travelPreferences: validGeocoded
          });
          console.log("Travel preferences saved successfully");
          
          // Trigger new search if city is already selected
          if (selectedCity) {
            handleSearch();
          }
        } catch (error) {
          console.error("Error saving travel preferences:", error);
          alert("Failed to save travel preferences. Please try again.");
        }
      } else {
        console.log("No user logged in, preferences will not be persisted");
      }
    } catch (error) {
      console.error("Error processing travel preferences:", error);
      alert("Failed to process travel preferences. Please try again.");
    }
  };

  const processResults = (results) => {
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
          travel_scores: location.travel_scores || {},  // New field
          lat: location.lat || 0,
          lon: location.lon || 0,
          google_maps_link: location.google_maps_link || 
            `https://www.google.com/maps?q=${location.lat},${location.lon}`,
          category: location.category || "Recommended Location",
          name: location.name || `Location ${index + 1}`,
          reason: location.reason || "",
          transit: location.transit || { score: 0, accessible_routes: [] }
        };
      }).filter(Boolean);

      console.log("✅ Processed results:", processedResults);
      
      if (processedResults.length > 0) {
        console.log("Setting search results:", processedResults);
        setSearchResults(processedResults);
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
        <h1 className="hero-title">Find Your Ideal Location</h1>
        <p className="hero-subtitle">
          Discover the perfect area based on your daily activities and travel preferences
        </p>
        
        <div className="search-container">
          <input
            type="text"
            placeholder="Enter a city name (e.g., Cardiff, UK)"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="city-input"
          />
          <button onClick={handleSearch} className="search-button">
            Search
          </button>
        </div>

        <TravelBehaviourForm 
          onSubmit={handleTravelPreferences}
          savedPreferences={travelPreferences}
        />

        {currentUser && (
          <div className="saved-locations-container">
            <div className="add-location-form">
              <input
                type="text"
                placeholder="Location label (e.g., Home)"
                className="location-label-input"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
              />
              <input
                type="text"
                placeholder="Enter postcode"
                className="postcode-input"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
              />
              <select 
                className="location-type-select"
                value={locationType}
                onChange={(e) => setLocationType(e.target.value)}
              >
                <option value="Home">Home</option>
                <option value="Work">Work</option>
                <option value="School">School</option>
                <option value="Other">Other</option>
              </select>
              <button 
                className="add-location-btn"
                onClick={handlePostcodeSubmit}
              >
                Add Location
              </button>
            </div>

            <div className="saved-postcodes-container">
              <h3>Saved Postcodes</h3>
              <div className="saved-postcodes-list">
                {savedPostcodes.map((postcode, index) => (
                  <div key={index} className="saved-postcode-item">
                    <span className="postcode-label">
                      {postcode.label} - {postcode.postcode}
                    </span>
                    <button
                      onClick={() => handleRemovePostcode(postcode.id)}
                      className="remove-postcode-btn"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Analyzing locations...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {hasSearched && !isLoading && !error && (
        <div className="map-section">
          <div className="map-container">
            <MapView 
              city={selectedCity} 
              locations={searchResults}
              savedPostcodes={[
                ...savedPostcodes,
                ...(travelPreferences?.map(pref => ({
                  id: `travel-${pref.type}-${pref.postcode}`,
                  label: `${pref.type} (${pref.frequency}x/week)`,
                  postcode: pref.postcode,
                  type: pref.type,
                  transportMode: pref.transportMode,
                  frequency: pref.frequency
                })) || [])
              ]}
            />
          </div>

          {searchResults.length === 0 ? (
            <div className="no-results">
              <p>No locations found for {selectedCity}. Try searching for a different city.</p>
            </div>
          ) : (
            <div className="results-section">
              <h2>Top {searchResults.length} Locations in {selectedCity.split(',')[0]}</h2>
              <div className="location-cards">
                {searchResults.map((location, index) => (
                  <div key={index} className="location-card">
                    <h3>Location {index + 1}</h3>
                    <p className="score">Score: {location.score}/100</p>
                    <p>Area: {location.area_name}</p>
                    
                    {/* Amenities Section */}
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

                    {/* Travel Times Section */}
                    {Object.keys(location.travel_scores || {}).length > 0 && (
                      <>
                        <h4>Travel Times:</h4>
                        <ul className="travel-list">
                          {Object.entries(location.travel_scores).map(([type, data]) => (
                            <li key={type}>
                              <span className="travel-type">{type}:</span>
                              {Math.round(data.travel_time)} mins by {data.transport_mode}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {/* Transit Information */}
                    {location.transit && (
                      <div className="transit-info">
                        <h4>Public Transport:</h4>
                        <p>Transit Score: {location.transit.score}/100</p>
                        <p>Bus Routes: {location.transit.accessible_routes.length}</p>
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
        </div>
      )}

      <div className="features-section">
        <h2 className="section-title">How It Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Set Your Preferences</h3>
            <p>Add your frequent destinations and travel habits</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Smart Search</h3>
            <p>Our algorithm analyzes travel times and amenities</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Compare Locations</h3>
            <p>View detailed scores and travel times for each area</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🚌</div>
            <h3>Transport Options</h3>
            <p>Consider multiple transport modes for your journeys</p>
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