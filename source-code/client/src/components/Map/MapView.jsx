import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapView.css';

// Set Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function MapView({ city = 'Cardiff, UK', locations = [] }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map only once
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-3.18, 51.48], // Default to Cardiff
        zoom: 12
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    // Clean up markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    if (locations.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();

      locations.forEach((location, index) => {
        bounds.extend([location.lon, location.lat]);

        // Create marker element
        const el = document.createElement('div');
        el.className = 'marker';
        el.innerHTML = '📍';

        // Create popup
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div class="popup-content">
              <h3>Location ${index + 1}</h3>
              <p class="score">Score: ${location.score}/100</p>
              <p>Area: ${location.area_name || 'Unknown'}</p>
              ${Object.entries(location.amenities || {}).map(([type, amenity]) => `
                <p>${type}: ${amenity.name} (${amenity.distance}m)</p>
              `).join('')}
              <a href="${location.google_maps_link}" target="_blank" rel="noopener noreferrer">
                View on Google Maps
              </a>
            </div>
          `);

        // Add marker to map
        const marker = new mapboxgl.Marker(el)
          .setLngLat([location.lon, location.lat])
          .setPopup(popup)
          .addTo(map.current);

        markersRef.current.push(marker);
      });

      // Fit map to bounds
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }

    return () => {
      if (map.current) {
        markersRef.current.forEach(marker => marker.remove());
        map.current.remove();
        map.current = null;
      }
    };
  }, [locations]);

  return (
    <div className="map-container">
      <div ref={mapContainer} className="map" />
    </div>
  );
}

export default MapView; 