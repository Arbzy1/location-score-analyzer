import { useState, useCallback } from "react";
import axios from "axios";
import "./SearchBar.css";

function SearchBar({ onSearchResults, onSearchStart }) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    const query = inputValue.trim();
    
    if (!query) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    if (onSearchStart) {
      onSearchStart(query);
    }
    
    const apiUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/amenities`;
    console.log("🌐 Making API request to:", apiUrl, "with query:", query);
    
    try {
      console.log("⏳ Starting API request...");
      const response = await axios.get(apiUrl, {
        params: { city: query },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        withCredentials: false
      });
      
      console.group("📥 Server Response Details");
      console.log("Status:", response.status);
      console.log("Headers:", response.headers);
      console.log("Raw response data:", response.data);
      
      if (response.data) {
        console.group("🏙️ City Data");
        console.log("Requested city:", response.data.city);
        console.log("Number of locations:", Array.isArray(response.data.locations) ? response.data.locations.length : 0);
        console.groupEnd();

        if (Array.isArray(response.data.locations) && response.data.locations.length > 0) {
          console.group("📍 Location Details");
          response.data.locations.forEach((location, index) => {
            console.group(`Location ${index + 1}`);
            console.log("Score:", location.score);
            console.log("Area Name:", location.area_name);
            console.log("Coordinates:", { lat: location.lat, lon: location.lon });
            console.log("Category:", location.category);
            console.log("Amenities:", location.amenities);
            console.log("Transit:", location.transit);
            console.groupEnd();
          });
          console.groupEnd();
          
          onSearchResults(response.data.locations);
        } else {
          console.log("ℹ️ No locations found in response");
          onSearchResults([]);
          setError("No locations found for this search. Try a different city.");
        }
      } else {
        console.error("❌ Invalid response structure:", response.data);
        throw new Error("Server response missing data");
      }
      console.groupEnd();

    } catch (err) {
      console.group("🔴 Error Details");
      console.error("Type:", err.name);
      console.error("Message:", err.message);
      console.error("Stack:", err.stack);
      
      if (err.response) {
        console.group("Server Error Response");
        console.error("Status:", err.response.status);
        console.error("Headers:", err.response.headers);
        console.error("Data:", err.response.data);
        console.groupEnd();
      } else if (err.request) {
        console.error("No response received from server");
      }
      console.groupEnd();
      
      const errorMessage = err.response?.data?.error || 
                          err.message || 
                          "An unexpected error occurred";
      setError(errorMessage);
      onSearchResults([]);
    } finally {
      console.log("🏁 Request completed");
      setIsLoading(false);
    }
  }, [inputValue, onSearchResults, onSearchStart]);

  return (
    <div className="search-bar">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter a city name (e.g., Cardiff, UK)"
          className="search-input"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="search-button"
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? (
            <span className="loading-text">Searching...</span>
          ) : (
            <span>Search</span>
          )}
        </button>
      </form>
      
      {error && (
        <div className="search-error">
          <p>{error}</p>
          <p className="error-help">
            Make sure the server is running and accessible at {import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}
          </p>
        </div>
      )}
    </div>
  );
}

export default SearchBar; 