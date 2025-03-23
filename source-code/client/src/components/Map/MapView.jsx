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
  
  // Create a new ref for map features
  const mapFeaturesRef = useRef({
    sources: {},
    layers: {}
  });

  // Function to clear amenity markers
  const clearAmenityMarkers = () => {
    if (map.current && map.current.loaded()) {
      // Remove all tracked layers
      Object.keys(mapFeaturesRef.current.layers).forEach(layerId => {
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
          delete mapFeaturesRef.current.layers[layerId];
        }
      });
      
      // Remove all tracked sources
      Object.keys(mapFeaturesRef.current.sources).forEach(sourceId => {
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
          delete mapFeaturesRef.current.sources[sourceId];
        }
      });
      
      // Remove event listeners
      map.current.off('click', 'amenity-points-layer');
      map.current.off('mouseenter', 'amenity-points-layer');
      map.current.off('mouseleave', 'amenity-points-layer');
    }
    
    // Clear any remaining standard markers
    if (amenityMarkersRef.current) {
      amenityMarkersRef.current.forEach(marker => marker.remove());
      amenityMarkersRef.current = [];
    }
  };

  // Function to add amenity markers
  const addAmenityMarkers = (amenities, mainLocationCoords) => {
    // Clear any existing amenity markers first
    clearAmenityMarkers();
    
    // Skip if no amenities
    if (!amenities || Object.keys(amenities).length === 0) {
      console.warn("No amenities data available");
      return;
    }
    
    // Ensure map is loaded before continuing
    if (!map.current || !map.current.loaded()) {
      console.log("Map not fully loaded yet, waiting...");
      setTimeout(() => addAmenityMarkers(amenities, mainLocationCoords), 100);
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
      'park': '#94d82d',
      'transport': '#fcc419',
      'pharmacy': '#cc5de8',
      'gym': '#20c997',
      'restaurant': '#ff922b',
      'default': '#868e96'
    };
    
    // Create GeoJSON feature collection for all amenity points
    const amenityPoints = {
      type: 'FeatureCollection',
      features: []
    };
    
    // Create GeoJSON feature collection for all connection lines
    const connectionLines = {
      type: 'FeatureCollection',
      features: []
    };
    
    // Process each amenity
    Object.entries(amenities).forEach(([type, amenity]) => {
      // Skip if no location data
      if (!amenity.lat || !amenity.lon) {
        console.warn(`Missing coordinates for ${type}`);
        return;
      }
      
      console.log(`Adding ${type} at ${amenity.lon}, ${amenity.lat}`);
      
      // Extend bounds to include this amenity
      bounds.extend([amenity.lon, amenity.lat]);
      
      // Determine color based on amenity type
      const color = amenityColors[type.toLowerCase()] || amenityColors.default;
      
      // Add icon based on type
      const iconMap = {
        'hospital': '🏥',
        'supermarket': '🛒',
        'school': '🏫',
        'park': '🌳',
        'transport': '🚍',
        'pharmacy': '💊',
        'gym': '💪',
        'restaurant': '🍽️',
      };
      
      const icon = iconMap[type.toLowerCase()] || '📍';
      
      // Add amenity point to GeoJSON
      amenityPoints.features.push({
        type: 'Feature',
        properties: {
          type: type,
          name: amenity.name,
          distance: amenity.distance,
          color: color,
          icon: icon
        },
        geometry: {
          type: 'Point',
          coordinates: [amenity.lon, amenity.lat]
        }
      });
      
      // Add connection line to GeoJSON
      connectionLines.features.push({
        type: 'Feature',
        properties: {
          type: type,
          color: color
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [mainLocationCoords.lon, mainLocationCoords.lat],
            [amenity.lon, amenity.lat]
          ]
        }
      });
    });
    
    // Add source and layer for connection lines
    try {
      // Add connection lines source
      const linesSourceId = 'amenity-lines-source';
      if (map.current.getSource(linesSourceId)) {
        map.current.removeLayer('amenity-lines-layer');
        map.current.removeSource(linesSourceId);
      }
      
      map.current.addSource(linesSourceId, {
        type: 'geojson',
        data: connectionLines
      });
      
      // Add connection lines layer
      map.current.addLayer({
        id: 'amenity-lines-layer',
        type: 'line',
        source: linesSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.7,
          'line-dasharray': [2, 1]
        }
      });
      
      // Track for cleanup
      mapFeaturesRef.current.sources[linesSourceId] = true;
      mapFeaturesRef.current.layers['amenity-lines-layer'] = true;
    } catch (error) {
      console.error('Error adding lines:', error);
    }
    
    // Add source and layer for amenity points
    try {
      // Add amenity points source
      const pointsSourceId = 'amenity-points-source';
      if (map.current.getSource(pointsSourceId)) {
        map.current.removeLayer('amenity-points-layer');
        map.current.removeSource(pointsSourceId);
      }
      
      map.current.addSource(pointsSourceId, {
        type: 'geojson',
        data: amenityPoints
      });
      
      // Add amenity points layer
      map.current.addLayer({
        id: 'amenity-points-layer',
        type: 'symbol',
        source: pointsSourceId,
        layout: {
          'text-field': ['get', 'icon'],
          'text-size': 20,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-anchor': 'bottom',
          'text-offset': [0, -0.25]
        }
      });
      
      // Track for cleanup
      mapFeaturesRef.current.sources[pointsSourceId] = true;
      mapFeaturesRef.current.layers['amenity-points-layer'] = true;
      
      // Set up click listeners for the points
      map.current.on('click', 'amenity-points-layer', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const properties = feature.properties;
          
          // Create popup
          const popupHTML = `
            <div class="popup-content">
              <h3 class="popup-title">${properties.name}</h3>
              <div class="info-row">
                <span>Type</span>
                <span>${properties.type}</span>
              </div>
              <div class="info-row">
                <span>Distance</span>
                <span>${properties.distance}m</span>
              </div>
            </div>
          `;
          
          // Create a popup and set its content
          new mapboxgl.Popup({ 
            offset: [0, -20],
            className: 'amenity-popup',
            closeButton: true,
            closeOnClick: false
          })
          .setLngLat(coordinates)
          .setHTML(popupHTML)
          .addTo(map.current);
        }
      });
      
      // Change cursor when hovering over points
      map.current.on('mouseenter', 'amenity-points-layer', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      
      map.current.on('mouseleave', 'amenity-points-layer', () => {
        map.current.getCanvas().style.cursor = '';
      });
    } catch (error) {
      console.error('Error adding points:', error);
    }
    
    // Create a visual circle around each amenity point (optional)
    try {
      const circlesSourceId = 'amenity-circles-source';
      if (map.current.getSource(circlesSourceId)) {
        map.current.removeLayer('amenity-circles-layer');
        map.current.removeSource(circlesSourceId);
      }
      
      map.current.addSource(circlesSourceId, {
        type: 'geojson',
        data: amenityPoints
      });
      
      map.current.addLayer({
        id: 'amenity-circles-layer',
        type: 'circle',
        source: circlesSourceId,
        paint: {
          'circle-radius': 14,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      }, 'amenity-points-layer'); // Add circle layer before text to show circles behind text
      
      // Track for cleanup
      mapFeaturesRef.current.sources[circlesSourceId] = true;
      mapFeaturesRef.current.layers['amenity-circles-layer'] = true;
    } catch (error) {
      console.error('Error adding circles:', error);
    }
    
    // Fit map to bounds
    map.current.fitBounds(bounds, {
      padding: { top: 70, bottom: 70, left: 70, right: 70 },
      maxZoom: 15,
      duration: 1000
    });
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