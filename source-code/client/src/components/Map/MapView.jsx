import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapView.css';

// Set Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function MapView({ city = 'Cardiff, UK', locations = [], savedLocations = [], savedPostcodes = [], recommendations = [] }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const recommendationMarkersRef = useRef([]);  // Separate ref for recommendation markers
  const savedLocationMarkersRef = useRef([]);  // Initialize as empty array
  const amenityMarkersRef = useRef([]); // New ref for amenity markers
  const markersRef = useRef({
    saved: [],
    recommendations: []
  });

  const [lng] = useState(-3.17909);
  const [lat] = useState(51.481583);
  const [zoom] = useState(12);
  
  // Function to clear amenity markers
  const clearAmenityMarkers = () => {
    if (amenityMarkersRef.current) {
      // Remove markers
      amenityMarkersRef.current.forEach(marker => marker.remove());
      
      // Remove lines
      if (amenityMarkersRef.current.lineIds) {
        amenityMarkersRef.current.lineIds.forEach(lineId => {
          if (map.current && map.current.getStyle()) {  // Check if map and style exist
            if (map.current.getLayer(lineId)) {
              map.current.removeLayer(lineId);
            }
            if (map.current.getSource(lineId)) {
              map.current.removeSource(lineId);
            }
          }
        });
      }
      
      amenityMarkersRef.current = [];
    }
  };

  // Function to add amenity markers
  const addAmenityMarkers = (amenities, mainLocationCoords) => {
    console.log("Adding amenity markers, data:", amenities);
    console.log("Main location:", mainLocationCoords);
    
    // Clear any existing amenity markers first
    clearAmenityMarkers();
    
    // Skip if no amenities
    if (!amenities || Object.keys(amenities).length === 0) {
      console.warn("No amenities data available");
      return;
    }
    
    // Ensure map is loaded
    if (!map.current || !map.current.loaded()) {
      console.warn("Map not loaded yet, cannot add markers");
      setTimeout(() => addAmenityMarkers(amenities, mainLocationCoords), 500);
      return;
    }
    
    // Create bounds object to include all points
    const bounds = new mapboxgl.LngLatBounds();
    
    // Add the main location to bounds
    bounds.extend([mainLocationCoords.lon, mainLocationCoords.lat]);
    
    // Define colors for different amenity types
    const amenityColors = {
      'hospital': '#ff6b6b',
      'supermarket': '#51cf66', 
      'school': '#339af0',
      'default': '#868e96'
    };
    
    // Add markers for each amenity
    let markersAdded = false;
    
    Object.entries(amenities).forEach(([type, amenity]) => {
      console.log(`Processing ${type} amenity:`, amenity);
      
      // Calculate coordinates if not explicitly provided
      let amenityLat, amenityLon;
      
      if (amenity.lat && amenity.lon) {
        amenityLat = amenity.lat;
        amenityLon = amenity.lon;
        console.log(`Using provided coordinates: [${amenityLat}, ${amenityLon}]`);
      } else {
        // When no coordinates are available, place based on distance in a cardinal direction
        console.log(`No coordinates for ${type}, calculating based on distance`);
        
        // Use type to determine a logical direction/bearing
        let bearing;
        switch(type.toLowerCase()) {
          case 'hospital': bearing = 0; break;     // North
          case 'supermarket': bearing = 90; break; // East  
          case 'school': bearing = 180; break;     // South
          default: bearing = 270; break;           // West
        }
        
        // Convert distance from meters to approximate degrees
        // This is a rough approximation (1 degree ~ 111km near the equator)
        const distanceInKm = amenity.distance / 1000;
        const distanceInDegrees = distanceInKm / 111;
        
        // Simple calculation for coordinates
        const bearingRad = bearing * Math.PI / 180;
        amenityLat = mainLocationCoords.lat + distanceInDegrees * Math.cos(bearingRad);
        amenityLon = mainLocationCoords.lon + distanceInDegrees * Math.sin(bearingRad) / 
                     Math.cos(mainLocationCoords.lat * Math.PI / 180);
        
        console.log(`Calculated coordinates: [${amenityLat}, ${amenityLon}]`);
      }
      
      // Skip if we don't have valid coordinates
      if (!amenityLat || !amenityLon || isNaN(amenityLat) || isNaN(amenityLon)) {
        console.warn(`Invalid coordinates for ${type}`);
        return;
      }
      
      // Extend bounds to include this amenity
      bounds.extend([amenityLon, amenityLat]);
      
      // Create custom element for the amenity marker
      const el = document.createElement('div');
      el.className = 'amenity-marker';
      
      // Determine color based on amenity type
      const color = amenityColors[type.toLowerCase()] || amenityColors.default;
      
      // Set background color
      el.style.backgroundColor = color;
      
      // Add icon based on type
      const iconMap = {
        'hospital': '🏥',
        'supermarket': '🛒',
        'school': '🏫',
      };
      
      const icon = iconMap[type.toLowerCase()] || '📍';
      el.innerHTML = `<span class="amenity-icon">${icon}</span>`;
      
      // Create popup for the amenity
      const popup = new mapboxgl.Popup({ 
        offset: 25,
        closeOnClick: false,
        className: 'amenity-popup'
      })
      .setHTML(`
        <div class="popup-content">
          <h3 class="popup-title">${amenity.name || type}</h3>
          <div class="info-row">
            <span>Type</span>
            <span>${type}</span>
          </div>
          <div class="info-row">
            <span>Distance</span>
            <span>${amenity.distance}m</span>
          </div>
        </div>
      `);
      
      console.log(`Adding marker for ${type} at [${amenityLon}, ${amenityLat}]`);
      
      // Add marker to map
      try {
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'bottom'
        })
        .setLngLat([amenityLon, amenityLat])
        .setPopup(popup)
        .addTo(map.current);
        
        // Store reference to marker
        amenityMarkersRef.current.push(marker);
        markersAdded = true;
        
        // Add a line connecting main location to this amenity
        const lineId = `route-to-${type}`;
        
        // Add the line to the map
        try {
          if (map.current.getSource(lineId)) {
            // If source already exists, update it
            const source = map.current.getSource(lineId);
            source.setData({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [mainLocationCoords.lon, mainLocationCoords.lat],
                  [amenityLon, amenityLat]
                ]
              }
            });
          } else {
            // Otherwise create a new source and layer
            map.current.addSource(lineId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [mainLocationCoords.lon, mainLocationCoords.lat],
                    [amenityLon, amenityLat]
                  ]
                }
              }
            });
            
            map.current.addLayer({
              id: lineId,
              type: 'line',
              source: lineId,
              paint: {
                'line-color': color,
                'line-width': 2,
                'line-dasharray': [2, 1],
                'line-opacity': 0.7
              }
            });
            
            // Store line ID for cleanup
            amenityMarkersRef.current.lineIds = amenityMarkersRef.current.lineIds || [];
            amenityMarkersRef.current.lineIds.push(lineId);
          }
        } catch (err) {
          console.error(`Error adding line for ${type}:`, err);
        }
      } catch (err) {
        console.error(`Error adding marker for ${type}:`, err);
      }
    });
    
    // Fit map to include all amenities with padding
    if (markersAdded) {
      console.log("Fitting map to bounds:", bounds);
      try {
        map.current.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 15,
          duration: 1000
        });
      } catch (err) {
        console.error("Error fitting bounds:", err);
      }
    } else {
      console.warn("No markers were added to map");
    }
  };

  // Add this debug function
  const debugAmenities = (amenities) => {
    console.log("--------- Amenities Debug ---------");
    console.log("Number of amenities:", Object.keys(amenities).length);
    
    Object.entries(amenities || {}).forEach(([type, amenity]) => {
      console.log(`Amenity: ${type}`);
      console.log(`  Name: ${amenity.name}`);
      console.log(`  Distance: ${amenity.distance}m`);
      console.log(`  Has coordinates: ${!!(amenity.lat && amenity.lon)}`);
      if (amenity.lat && amenity.lon) {
        console.log(`  Coordinates: [${amenity.lat}, ${amenity.lon}]`);
      }
    });
    
    console.log("-----------------------------------");
  };

  useEffect(() => {
    console.log('MapView received savedPostcodes:', savedPostcodes);
    if (!mapContainer.current) return;

    // Initialize map only once
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [lng, lat],
        zoom: zoom
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    // Function to clear all markers of a specific type
    const clearMarkers = (markersRef) => {
      if (Array.isArray(markersRef.current)) {
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
      } else {
        Object.values(markersRef.current).forEach(marker => marker.remove());
        markersRef.current = {};
      }
    };

    // Clear existing markers
    clearMarkers(recommendationMarkersRef);
    clearMarkers(savedLocationMarkersRef);
    clearAmenityMarkers();

    // Create bounds object
    const bounds = new mapboxgl.LngLatBounds();

    // Add recommendation markers
    if (locations.length > 0) {
      locations.forEach((location, index) => {
        bounds.extend([location.lon, location.lat]);

        // Create marker element for recommendations
        const el = document.createElement('div');
        el.className = 'recommendation-marker';
        el.innerHTML = '📍';

        // Create popup
        const popup = new mapboxgl.Popup({ 
          offset: 25, 
          className: 'custom-location-popup',
          closeOnClick: false,
          maxWidth: '320px',
          anchor: 'bottom',
          focusAfterOpen: false
        })
        .setHTML(`
          <div class="popup-content">
            <h3 class="popup-title">Location ${index + 1}</h3>
            
            <div class="popup-info">
              <div class="info-row">
                <span>Score</span>
                <span>${location.score}/100</span>
              </div>
              <div class="info-row">
                <span>Area</span>
                <span>${location.area_name || 'Unknown'}</span>
              </div>
            </div>
            
            <div class="amenities-section">
              ${Object.entries(location.amenities || {}).map(([type, amenity]) => `
                <div class="info-row">
                  <span>${type}</span>
                  <span>${amenity.name} · ${amenity.distance}m</span>
                </div>
              `).join('')}
            </div>
            
            <div class="popup-actions">
              <button class="show-amenities-btn">Show Amenities on Map</button>
              <a href="${location.google_maps_link}" target="_blank" rel="noopener noreferrer" class="maps-link">
                View on Google Maps
              </a>
            </div>
          </div>
        `);

        // Add recommendation marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([location.lon, location.lat])
          .setPopup(popup)
          .addTo(map.current);

        // Add event listener to the "Show Amenities" button after popup is open
        marker.getPopup().on('open', () => {
          // Clear other amenity markers when a new popup is opened
          clearAmenityMarkers();
          
          setTimeout(() => {
            const showAmenitiesBtn = document.querySelector('.show-amenities-btn');
            if (showAmenitiesBtn) {
              showAmenitiesBtn.addEventListener('click', () => {
                console.log("Show Amenities button clicked for location:", location);
                
                if (!location.amenities || Object.keys(location.amenities).length === 0) {
                  console.warn("No amenities data available for this location");
                  alert("No amenity data available for this location");
                  return;
                }
                
                // Debug amenities data
                debugAmenities(location.amenities);
                
                // Add amenity markers
                addAmenityMarkers(location.amenities, {lon: location.lon, lat: location.lat});
              });
            }
          }, 100);
        });

        recommendationMarkersRef.current.push(marker);
      });
    }

    // Add saved location markers
    savedLocations.forEach(location => {
      bounds.extend([location.longitude, location.latitude]);

      // Create marker element
      const el = document.createElement('div');
      el.className = 'saved-location-marker';
      const locationType = location.type || 'other';
      el.setAttribute('data-type', locationType);

      // Create popup with the label
      const popup = new mapboxgl.Popup({
        offset: 12,
        closeButton: false,
        className: 'custom-popup'
      })
      .setHTML(`
        <div class="popup-content">
          <h3>${location.label}</h3>
          <p>${location.postcode}</p>
        </div>
      `);

      // Add marker with popup
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom',  // This ensures the marker points to the exact location
      })
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map.current);

      // Show popup by default to display the label
      marker.togglePopup();

      savedLocationMarkersRef.current.push(marker);
    });

    // Fit map to bounds if there are any points
    if (locations.length > 0 || savedLocations.length > 0) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }

    return () => {
      // Cleanup
      clearMarkers(recommendationMarkersRef);
      clearMarkers(savedLocationMarkersRef);
    };
  }, [locations, savedLocations, savedPostcodes, lng, lat, zoom]);

  useEffect(() => {
    if (!map.current || !savedPostcodes) return;

    console.log('Updating saved postcode markers:', savedPostcodes);

    // Clear existing saved markers
    markersRef.current.saved.forEach(marker => marker.remove());
    markersRef.current.saved = [];

    // Add new markers
    savedPostcodes.forEach(location => {
      if (!location.latitude || !location.longitude) {
        console.warn('Invalid location data:', location);
        return;
      }

      const el = document.createElement('div');
      el.className = 'saved-location-marker';
      
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div class="popup-content">
            <h3>${location.label}</h3>
            <p>${location.postcode}</p>
          </div>
        `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map.current);

      markersRef.current.saved.push(marker);
    });
  }, [savedPostcodes]);

  // Add this handler to prevent map zoom when scrolling inside popup
  useEffect(() => {
    if (!map.current) return;

    map.current.on('load', () => {
      // Find all popups and add event listeners to prevent scroll propagation
      document.addEventListener('DOMNodeInserted', (e) => {
        if (e.target.classList && (
            e.target.classList.contains('mapboxgl-popup-content') || 
            e.target.classList.contains('amenity-popup'))) {
          e.target.addEventListener('wheel', (event) => {
            event.stopPropagation();
          });
        }
      });
    });
  }, []);

  return (
    <div className="map-container">
      <div ref={mapContainer} className="map" />
      {locations.length > 0 && (
        <h2 className="locations-title">Top 10 Locations in {city.split(',')[0]}</h2>
      )}
    </div>
  );
}

export default MapView; 