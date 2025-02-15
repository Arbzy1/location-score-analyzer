import { useState, useEffect } from "react";
import { auth, provider } from "./firebase"; // Ensure auth is exported in firebase.js
import { signInWithPopup, signOut } from "firebase/auth";
import axios from "axios";
import "./App.css";

// Only need Flask API URL now
const FLASK_API = import.meta.env.VITE_FLASK_API;

function App() {
  const [user, setUser] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [city, setCity] = useState("Cardiff, UK");
  const [loading, setLoading] = useState(false);

  // Google Sign-in
  const signIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (error) {
      console.error("❌ Login failed", error);
      alert("Login failed. Please try again.");
    }
  };

  // Logout function
  const logout = () => {
    signOut(auth)
      .then(() => {
        setUser(null);
        setSearchResults([]);
      })
      .catch((error) => console.error("❌ Logout failed", error));
  };

  // Function to render a single amenity card
  const renderAmenityCard = (item, category, index) => {
    return (
      <div key={`${category}-${index}`} className="amenity-card">
        <h4>Location {index + 1}</h4>
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
  };

  // Function to render additional information
  const renderAdditionalInfo = (item) => {
    const skipFields = [
      'name', 'type', 'distance', 'lat', 'lon', 
      'reason', 'google_maps_link', 'category',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
    ];

    return Object.entries(item).map(([key, value]) => {
      if (skipFields.includes(key) || 
          !value || 
          value === "" || 
          value === " " || 
          value === "\n" ||
          value === "\"\"" ||
          typeof value === "object") {
        return null;
      }

      const formattedKey = key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return (
        <p key={key} className="additional-info">
          <span>{formattedKey}:</span> {value.toString()}
        </p>
      );
    });
  };

  // Fetch amenities function
  const fetchAmenities = async () => {
    setLoading(true);
    try {
      console.log('🔍 Searching for:', city);
      
      const response = await axios.get(`${FLASK_API}/amenities`, {
        params: { city },
        headers: {
          'Authorization': `Bearer ${user?.accessToken}`,
          'Content-Type': 'application/json',
        },
        withCredentials: false
      });
      
      console.log('📥 Raw response:', response.data);

      // Extract locations from the response
      const locationsData = response.data.locations || [];
      console.log('📍 Found locations:', locationsData.length);

      if (locationsData.length === 0) {
        console.log('⚠️ No locations found');
        setSearchResults([]);
        return;
      }

      // Process the locations
      const cleanedResults = locationsData.map(item => ({
        name: item.name || "Unknown Location",
        type: item.category || "Unknown Type",
        lat: parseFloat(item.lat) || 0,
        lon: parseFloat(item.lon) || 0,
        reason: item.reason || "",
        google_maps_link: item.google_maps_link,
        ...item
      }));

      console.log('✨ Processed locations:', cleanedResults.length);

      // Update results
      setSearchResults(cleanedResults);

    } catch (error) {
      console.log('❌ Error:', error.message);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Add a useEffect to monitor searchResults changes
  useEffect(() => {
    console.log('🔄 Search results updated:', searchResults.length);
    console.log('📋 Current results:', searchResults);
  }, [searchResults]);

  return (
    <div className="container">
      <h1>Street Network Analysis</h1>

      {user ? (
        <>
          <div className="welcome-section">
            <p>Welcome, {user.displayName}!</p>
            <button onClick={logout} className="btn">Logout</button>
          </div>

          <div className="input-group">
            <input 
              type="text" 
              value={city} 
              onChange={(e) => setCity(e.target.value)} 
              placeholder="Enter a city name..." 
            />
            <button onClick={fetchAmenities} className="btn">
              {loading ? 'Searching...' : 'Fetch Amenities'}
            </button>
          </div>

          <div className="results-container">
            {loading && <div className="loading">Searching for amenities...</div>}
            
            {searchResults && searchResults.length > 0 && (
              Object.entries(
                searchResults.reduce((acc, item) => {
                  const category = item.type || 'Other';
                  if (!acc[category]) acc[category] = [];
                  acc[category].push(item);
                  return acc;
                }, {})
              ).map(([category, items]) => (
                <div key={category} className="category-section">
                  <h3>{category} ({items.length})</h3>
                  <div className="card-grid">
                    {items.map((item, index) => renderAmenityCard(item, category, index))}
                  </div>
                </div>
              ))
            )}
            
            {!loading && (!searchResults || searchResults.length === 0) && (
              <div className="loading">
                No results found for "{city}". Try another location or check your spelling.
              </div>
            )}
          </div>
        </>
      ) : (
        <button onClick={signIn} className="btn">Sign in with Google</button>
      )}
    </div>
  );
}

export default App;
