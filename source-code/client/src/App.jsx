import { useState, useEffect } from "react";
import { auth, provider } from "./firebase"; // Ensure auth is exported in firebase.js
import { signInWithPopup, signOut } from "firebase/auth";
import axios from "axios";
import "./App.css";

// Load environment variables
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;  // Node.js API
const FLASK_API = import.meta.env.VITE_FLASK_API;      // Flask API

function App() {
  const [user, setUser] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [city, setCity] = useState("Cardiff, UK");
  const [loading, setLoading] = useState(false);

  // 🔹 Google Sign-in
  const signIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (error) {
      console.error("Login failed", error);
      alert("Login failed. Please try again.");
    }
  };

  // 🔹 Logout function
  const logout = () => {
    signOut(auth)
      .then(() => {
        setUser(null);
        setSearchResults([]);
      })
      .catch((error) => console.error("Logout failed", error));
  };

  // 🔹 Fetch amenities from Flask backend via Node.js
  const fetchAmenities = async () => {
    if (!user) {
      alert("You need to be logged in to fetch data.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${FLASK_API}/api/amenities?city=${city}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to fetch amenities. Make sure Flask & Node.js are running.");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Save search results to Firebase (via Node.js API)
  const saveSearch = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }

    try {
      await axios.post(`${BACKEND_URL}/api/save_search`, {
        user: user.email,
        search: city,
      });
      alert("Search saved successfully!");
    } catch (error) {
      console.error("Error saving search:", error);
      alert("Failed to save search.");
    }
  };

  return (
    <div className="container">
      <h1>Street Network Analysis</h1>

      {user ? (
        <>
          <p>Welcome, {user.displayName}!</p>
          <button onClick={logout} className="btn">Logout</button>

          <div className="input-group">
            <input 
              type="text" 
              value={city} 
              onChange={(e) => setCity(e.target.value)} 
              placeholder="Enter city..." 
            />
            <button onClick={fetchAmenities} className="btn">Fetch Amenities</button>
            <button onClick={saveSearch} className="btn">Save Search</button>
          </div>

          {loading ? <p>Loading...</p> : null}

          <h2>Results:</h2>
          <ul className="results-list">
            {searchResults.length > 0 ? (
              searchResults.map((item, index) => (
                <li key={index}>
                  <strong>{item.name}</strong> - {item.type} - {item.distance} miles away
                  <br />
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    View on Google Maps
                  </a>
                </li>
              ))
            ) : (
              <p>No results found. Try another city.</p>
            )}
          </ul>
        </>
      ) : (
        <button onClick={signIn} className="btn">Sign in with Google</button>
      )}
    </div>
  );
}

export default App;
