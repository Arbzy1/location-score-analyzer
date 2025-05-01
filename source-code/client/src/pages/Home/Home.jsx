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
import { TransportBreakdown } from '../../components/TransportBreakdown/TransportBreakdown';

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
  const [showScoreExplanation, setShowScoreExplanation] = useState(false);
  const [travelMode, setTravelMode] = useState("auto");

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
          // Load saved travel preferences with default weights if not present
          if (userData.travelPreferences) {
            console.log('Loading travel preferences:', userData.travelPreferences);
            const locations = Array.isArray(userData.travelPreferences)
              ? userData.travelPreferences
              : (userData.travelPreferences.locations || []);
            
            // Ensure types are preserved exactly as they are in Firebase
            const processedLocations = locations.map(loc => {
              // Ensure type is properly set with a default if missing
              const type = loc.type || 'Home';
              return {
                ...loc,
                type: type,  // Use the validated type
                frequency: loc.frequency || 1  // Ensure frequency is never undefined
              };
            });
            
            console.log('Processed locations with types:', processedLocations.map(loc => ({ 
              postcode: loc.postcode, 
              type: loc.type, 
              frequency: loc.frequency 
            })));
            
            setTravelPreferences({
              locations: processedLocations,
              amenityWeights: userData.travelPreferences.amenityWeights || {
                school: 15,
                hospital: 15,
                supermarket: 10
              },
              travelMode: userData.travelPreferences.travelMode || 'auto'
            });

            console.log('Loaded travel mode:', userData.travelPreferences.travelMode || 'auto');
            
            // Also update the travelMode state
            setTravelMode(userData.travelPreferences.travelMode || 'auto');
          }
        } else {
          console.log('Creating new user document');
          await setDoc(userDoc, { 
            savedPostcodes: [],
            travelPreferences: {
              locations: [],
              amenityWeights: {
                school: 15,
                hospital: 15,
                supermarket: 10
              }
            },
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
      const response = await fetch(`http://localhost:5000/api/postcode/${encodeURIComponent(postcode)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
      }

      const data = await response.json();
      
      if (data.status !== 200) {
        throw new Error(data.error || 'Invalid postcode');
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
        travelMode: travelMode,
        timestamp: new Date().toISOString()
      };

      await updateDoc(userDoc, {
        savedPostcodes: arrayUnion(newPostcode)
      });

      setSavedPostcodes(prev => [...prev, newPostcode]);
      setLocationLabel("");
      setPostcode("");
      setLocationType("Home");
      setTravelMode("auto");
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

    console.log("🔍 Starting search with city:", selectedCity);
    console.log("📝 Travel preferences:", travelPreferences);
    
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const url = `/api/amenities`;
      const params = {
        city: selectedCity,
        travel_preferences: JSON.stringify(travelPreferences),
        _t: Date.now() // Add timestamp to prevent caching
      };
      
      console.log("🌐 Making request to:", url);
      console.log("📦 Request params:", params);
      
      const response = await axios.get(url, {
        params: params,
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log("✅ Received response:", response);
      
      if (response.data) {
        if (response.data.locations && Array.isArray(response.data.locations)) {
          // Object format with locations array
          console.log("📊 Processing results from locations property:", response.data.locations);
          processResults(response.data.locations);
        } else if (Array.isArray(response.data)) {
          // Direct array format
          console.log("📊 Processing results from direct array:", response.data);
          processResults(response.data);
        } else {
          console.log("❌ No valid locations found in response");
          setError("No results found");
          setSearchResults([]);
        }
      } else {
        console.log("❌ No data in response");
        setError("No results found");
        setSearchResults([]);
      }
    } catch (err) {
      console.error("❌ Error during search:", err);
      console.error("Error details:", {
        message: err.message,
        response: err.response,
        request: err.request
      });
      setError(err.response?.data?.message || "An error occurred during search");
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTravelPreferences = async (preferences) => {
    console.log("🔍 DEBUG: Received preferences from form:", JSON.stringify(preferences, null, 2));
    console.log("🔍 DEBUG: Types in received preferences:", preferences.locations.map(loc => ({ 
      postcode: loc.postcode, 
      type: loc.type, 
      frequency: loc.frequency 
    })));
    
    try {
      // Geocode all postcodes using postcodes.io API directly
      const geocodedPreferences = await Promise.all(
        preferences.locations.map(async (pref) => {
          if (!pref.postcode) return null;
          
          // Clean the postcode
          const cleanedPostcode = pref.postcode.trim().replace(/\s+/g, '');
          console.log("🔍 DEBUG: Processing preference with cleaned postcode:", cleanedPostcode);
          
          try {
            const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleanedPostcode)}`);
            
            if (!response.ok) {
              const errorData = await response.json();
              console.error(`Failed to geocode postcode ${cleanedPostcode}:`, errorData);
              return null;
            }

            const data = await response.json();
            
            if (data.status !== 200) {
              console.error(`Failed to geocode postcode ${cleanedPostcode}:`, data.error);
              return null;
            }

            const { latitude, longitude } = data.result;
            
            return {
              ...pref,
              postcode: cleanedPostcode, // Use cleaned postcode
              lat: latitude,
              lng: longitude,
              timestamp: new Date().toISOString(),
              id: `${pref.type}-${cleanedPostcode}`,
              frequency: pref.frequency || 1
            };
          } catch (error) {
            console.error(`Error processing postcode ${cleanedPostcode}:`, error);
            return null;
          }
        })
      );

      // Filter out null results
      const validGeocoded = geocodedPreferences.filter(pref => pref !== null);
      console.log("🔍 DEBUG: Valid geocoded preferences:", JSON.stringify(validGeocoded, null, 2));
      console.log("🔍 DEBUG: Types in geocoded preferences:", validGeocoded.map(loc => ({ 
        postcode: loc.postcode, 
        type: loc.type, 
        frequency: loc.frequency 
      })));

      if (validGeocoded.length === 0) {
        throw new Error("No valid locations could be geocoded. Please check your postcodes and try again.");
      }

      // Create the complete preferences object with both locations and weights
      const completePreferences = {
        locations: validGeocoded,
        amenityWeights: preferences.amenityWeights,
        travelMode: preferences.travelMode
      };

      console.log("🔍 DEBUG: Complete preferences:", JSON.stringify(completePreferences, null, 2));
      // Save preferences to state
      setTravelPreferences(completePreferences);

      // Save preferences to Firebase if user is logged in
      if (currentUser) {
        try {
          console.log("Saving travel preferences to Firebase for user:", currentUser.uid);
          console.log("🔍 DEBUG: Types being saved to Firebase:", validGeocoded.map(loc => ({ 
            postcode: loc.postcode, 
            type: loc.type, 
            frequency: loc.frequency 
          })));
          
          const userDoc = doc(db, 'users', currentUser.uid);
          await updateDoc(userDoc, {
            travelPreferences: completePreferences
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
        // Still trigger search even if not logged in
        if (selectedCity) {
          handleSearch();
        }
      }
    } catch (error) {
      console.error("Error processing travel preferences:", error);
      alert(error.message || "Failed to process travel preferences. Please try again.");
    }
  };

  const processResults = (results) => {
    console.log("🔍 Processing results:", results);
    try {
      // Check if results is already an array (direct array format)
      if (Array.isArray(results)) {
        const processedResults = results.map((location, index) => {
          if (!location) return null;

          return {
            ...location,
            id: location.id || `location-${index}`,
            lat: location.lat,
            lng: location.lon,
            score: location.score || 0,
            amenities: location.amenities || {},
            area_name: location.area_name || "Unknown Area",
            google_maps_link: location.google_maps_link || `https://www.google.com/maps?q=${location.lat},${location.lon}`,
            travel_scores: location.travel_scores || {},
            category: location.category || "Recommended Location",
            name: location.name || `Location ${index + 1}`,
            reason: location.reason || "",
            transit: location.transit || { score: 0, accessible_routes: [] },
            score_breakdown: location.score_breakdown || {
              travel: 0,
              amenities: { total: 0 },
              transit: { score: 0 }
            },
            transport_modes: location.transport_modes || {}
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
        return;
      }

      // Handle object format with locations property
      if (results && results.locations && Array.isArray(results.locations)) {
        const processedResults = results.locations.map((location, index) => {
          if (!location) return null;

          return {
            ...location,
            id: location.id || `location-${index}`,
            lat: location.lat,
            lng: location.lon,
            score: location.score || 0,
            amenities: location.amenities || {},
            area_name: location.area_name || "Unknown Area",
            google_maps_link: location.google_maps_link || `https://www.google.com/maps?q=${location.lat},${location.lon}`,
            travel_scores: location.travel_scores || {},
            category: location.category || "Recommended Location",
            name: location.name || `Location ${index + 1}`,
            reason: location.reason || "",
            transit: location.transit || { score: 0, accessible_routes: [] },
            score_breakdown: location.score_breakdown || {
              travel: 0,
              amenities: { total: 0 },
              transit: { score: 0 }
            },
            transport_modes: location.transport_modes || {}
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
        return;
      }

      // If we got here, the format is invalid
      console.error("Invalid results format:", results);
      throw new Error("Invalid results format");
      
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
              <select
                className="travel-mode-select"
                value={travelMode}
                onChange={(e) => setTravelMode(e.target.value)}
              >
                <option value="auto">Auto (Fastest)</option>
                <option value="walking">Walking</option>
                <option value="cycling">Cycling</option>
                <option value="driving">Driving</option>
                <option value="bus">Bus Transit</option>
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
                      <span className="travel-mode-label">
                        ({postcode.travelMode || 'auto'})
                      </span>
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
                ...(travelPreferences?.locations.map(pref => ({
                  id: `travel-${pref.type}-${pref.postcode}`,
                  label: `${pref.type} (${pref.frequency}x/week)`,
                  postcode: pref.postcode,
                  type: pref.type,
                  transportMode: pref.transportMode,
                  frequency: pref.frequency,
                  lat: pref.lat,
                  lng: pref.lng
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
              
              {/* Score Explanation Toggle Button */}
              <div className="score-explanation-toggle">
                <button 
                  onClick={() => setShowScoreExplanation(!showScoreExplanation)}
                  className="toggle-explanation-btn"
                >
                  {showScoreExplanation ? 'Hide Score Explanation' : 'Show Score Explanation'}
                </button>
              </div>
              
              {/* Score Explanation Box */}
              {showScoreExplanation && (
                <div className="score-explanation-box">
                  <h3>How We Calculate Scores</h3>
                  
                  {/* Score Interpretation Guide */}
                  <div className="score-interpretation">
                    <h4>Understanding Your Score</h4>
                    <div className="score-ranges">
                      <div className="score-range excellent">
                        <span className="range">90-100</span>
                        <span className="label">Excellent</span>
                        <p>Perfect location with minimal travel time, excellent amenities, and great public transport</p>
                      </div>
                      <div className="score-range good">
                        <span className="range">75-89</span>
                        <span className="label">Very Good</span>
                        <p>Strong choice with good balance of travel times and amenities</p>
                      </div>
                      <div className="score-range average">
                        <span className="range">60-74</span>
                        <span className="label">Good</span>
                        <p>Decent location with reasonable travel times and access to basic amenities</p>
                      </div>
                      <div className="score-range below-average">
                        <span className="range">40-59</span>
                        <span className="label">Fair</span>
                        <p>Some compromises in either travel time or amenity access</p>
                      </div>
                      <div className="score-range poor">
                        <span className="range">0-39</span>
                        <span className="label">Needs Improvement</span>
                        <p>Significant travel time or limited access to essential amenities</p>
                      </div>
                    </div>
                  </div>

                  <div className="score-breakdown">
                    <div className="score-component">
                      <h4>Amenities (40%)</h4>
                      <ul>
                        <li>Schools (15%): Based on distance to nearest school</li>
                        <li>Hospitals (4%): Based on distance to nearest hospital</li>
                        <li>Supermarkets (21%): Based on distance to nearest supermarket</li>
                      </ul>
                    </div>
                    <div className="score-component">
                      <h4>Public Transport (20%)</h4>
                      <ul>
                        <li>Based on number of accessible bus routes</li>
                        <li>Distance to nearest bus stop</li>
                      </ul>
                    </div>
                    <div className="score-component">
                      <h4>Travel Behavior (40%)</h4>
                      <ul>
                        <li>Calculated using real driving times from OSRM</li>
                        <li>Weighted by visit frequency (more frequent trips have higher impact)</li>
                        <li>Target: Keep weekly travel time under 600 minutes (10 hours)</li>
                        <li>Score decreases as weekly travel time approaches or exceeds target</li>
                      </ul>
                    </div>
                  </div>
                  <div className="score-tips">
                    <h4>Tips for Interpreting Scores</h4>
                    <ul>
                      <li>A score above 75 indicates an excellent location that meets most of your needs</li>
                      <li>Weekly travel time over 600 minutes significantly impacts the travel score</li>
                      <li>Amenities within 1km (2km for hospitals) receive the highest scores</li>
                      <li>More bus routes and closer stops improve the transit score</li>
                    </ul>
                  </div>
                </div>
              )}
              
              <div className="location-cards">
                {searchResults.map((location, index) => (
                  <div key={index} className="location-card">
                    <h3>Location {index + 1}</h3>
                    <div className="score-container">
                      <p className="score">Score: {parseFloat(location.score).toFixed(1)}/100</p>
                      <button 
                        className="score-info-btn"
                        onClick={() => setShowScoreExplanation(true)}
                        title="Learn how this score is calculated"
                      >
                        <span className="info-icon">ⓘ</span>
                      </button>
                    </div>
                    <p>Area: {location.area_name}</p>

                    {/* Travel Analysis Section */}
                    {Object.keys(location.travel_scores || {}).length > 0 && (
                      <div className="travel-summary-box">
                        <h4>Travel & Transit Analysis</h4>
                        <div className="travel-metrics">
                          <div className="metric">
                            <span className="metric-label">Weekly Travel:</span>
                            <span className="metric-value">
                              {Math.round(Object.values(location.travel_scores)
                                .reduce((total, data) => total + ((data.travel_time || 0) * (data.frequency || 1)), 0))} mins/week
                            </span>
                          </div>
                          <div className="metric">
                            <span className="metric-label">Transit Score:</span>
                            <span className="metric-value">
                              {location.transit?.score || 0}/100 ({location.transit?.accessible_routes?.length || 0} routes)
                            </span>
                          </div>
                        </div>

                        <div className="travel-destinations">
                          <h5>Journey Details:</h5>
                          <ul>
                            {travelPreferences?.locations.map(pref => {
                              const key = `${pref.type}-${pref.postcode}`;
                              const data = location.travel_scores[key];
                              if (!data) return null;
                              
                              return (
                                <li key={key} className="journey-detail">
                                  <div className="journey-header">
                                    <div className="journey-title">
                                      <strong>{pref.type}</strong>
                                      <span className="journey-postcode"> - {pref.postcode}</span>
                                    </div>
                                    <span className="journey-frequency">{pref.frequency}x per week</span>
                                  </div>
                                  <div className="journey-stats">
                                    <span>Single trip: {Math.round(data.travel_time || 0)} mins</span>
                                    <span>Weekly total: {Math.round((data.travel_time || 0) * (pref.frequency || 1))} mins</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Score Breakdown Section */}
                    <div className="score-breakdown-card">
                      <h4>Score Breakdown</h4>
                      <div className="score-components">
                        <div className="score-component-item">
                          <span>Travel (40%):</span>
                          <span>{(location.score_breakdown?.travel || 0).toFixed(1)}</span>
                        </div>
                        <div className="score-component-item">
                          <span>Amenities (40%):</span>
                          <span>{parseFloat(location.score_breakdown?.amenities?.total || 0).toFixed(1)}</span>
                        </div>
                        <div className="score-component-item">
                          <span>Transit (20%):</span>
                          <span>{parseFloat(location.score_breakdown?.transit?.score || 0).toFixed(1)}</span>
                        </div>
                        <div className="total-score">
                          <span>Final Score:</span>
                          <span>{parseFloat(location.score || 0).toFixed(1)}</span>
                        </div>
                      </div>

                      {/* Add Transport Mode Breakdown */}
                      <TransportBreakdown 
                        transport_modes={location.transport_modes || {}} 
                        travel_details={location.score_breakdown?.travel_details}
                      />

                      {/* Amenities Section */}
                      {Object.keys(location.amenities || {}).length > 0 && (
                        <div className="amenities-section">
                          <h5>Nearby Amenities:</h5>
                          <ul className="amenities-list">
                            {Object.entries(location.amenities || {}).map(([type, amenity]) => {
                              if (!amenity || !amenity.weight) return null;
                              return (
                                <li key={type}>
                                  <span className="amenity-type">{type}:</span>
                                  <div className="amenity-details">
                                    <span>{amenity.name || type} ({amenity.distance}m)</span>
                                    <span className="amenity-score">Score: {amenity.score.toFixed(1)}/{amenity.weight}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                    
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