import FrequentLocations from '../Search/FrequentLocations';

function Home() {
  // ... existing state

  return (
    <div className="home">
      <h1>Find the Best Locations</h1>
      <p>Discover optimal locations based on proximity to schools, hospitals, and supermarkets</p>
      
      <div className="search-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Enter a city name (e.g., Cardiff, UK)"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            className="search-input"
          />
          <button onClick={handleSearch} className="search-button">
            Search
          </button>
        </div>
        
        <FrequentLocations onAddLocation={handleAddLocation} />
      </div>
      
      {/* ... rest of your component */}
    </div>
  );
}

export default Home; 