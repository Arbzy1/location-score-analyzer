import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapView.css';

// Disable telemetry
mapboxgl.config.ENABLE_TELEMETRY = false;

// Set Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function MapView({ city = 'Cardiff, UK', locations = [] }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [mapError, setMapError] = useState(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    try {
      // Initialize map only once
      if (!map.current) {
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [-3.18, 51.48], // Default to Cardiff
          zoom: 12,
          attributionControl: true,
          trackResize: true,
          collectResourceTiming: false,
          localIdeographFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif"
        });

        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Handle map load errors
        map.current.on('error', (e) => {
          console.error('Mapbox error:', e);
          setMapError('Error loading map. Please check your connection and refresh the page.');
        });
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setMapError('Error initializing map. Please check your Mapbox token and refresh the page.');
    }

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!map.current || !locations.length) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Create bounds object to fit all markers
    const bounds = new mapboxgl.LngLatBounds();

    // Add new markers
    locations.forEach((location, index) => {
      if (!location.lon || !location.lat) return;

      const el = document.createElement('div');
      el.className = 'marker';
      el.innerHTML = '📍';

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="popup-content">
          <h3>Location ${index + 1}</h3>
          <p class="score">Score: ${location.score}/100</p>
          <p>Area: ${location.area_name || 'Unknown'}</p>
          ${Object.entries(location.amenities || {})
            .map(([type, amenity]) => 
              `<p>${type}: ${amenity.name} (${amenity.distance}m)</p>`
            )
            .join('')}
          <a href="${location.google_maps_link}" target="_blank" rel="noopener noreferrer">View on Google Maps</a>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.lon, location.lat])
        .setPopup(popup)
        .addTo(map.current);

      markersRef.current.push(marker);
      bounds.extend([location.lon, location.lat]);
    });

    // Only fit bounds if we have markers
    if (markersRef.current.length > 0) {
      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15
      });
    }
  }, [locations]);

  return (
    <div className="map-container">
      <div ref={mapContainer} className="map" />
    </div>
  );
}

export default MapView; 