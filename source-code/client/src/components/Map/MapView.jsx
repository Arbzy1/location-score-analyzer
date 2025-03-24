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

  // Update state to include separate bus routes toggle
  const [layersVisible, setLayersVisible] = useState({
    transit: false,
    busRoutes: false,
    traffic: false,
    buildings3d: false
  });

  // Add a new state for bus data loading
  const [busRoutesData, setBusRoutesData] = useState(null);
  const [busDataLoading, setBusDataLoading] = useState(false);
  const [busDataLoaded, setBusDataLoaded] = useState(false);

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
        'pharmacy': '��',
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

  // Function to toggle map layers
  const toggleMapLayer = (layerType) => {
    setLayersVisible(prev => {
      const newState = { ...prev, [layerType]: !prev[layerType] };
      
      // Apply changes to the map
      if (map.current && map.current.loaded()) {
        switch (layerType) {
          case 'transit':
            applyTransitLayerVisibility(!prev.transit);
            break;
          case 'busRoutes':
            applyBusRoutesVisibility(!prev.busRoutes);
            break;
          case 'traffic':
            applyTrafficLayerVisibility(!prev.traffic);
            break;
          case 'buildings3d':
            applyBuildings3DVisibility(!prev.buildings3d);
            break;
          default:
            break;
        }
      }
      
      return newState;
    });
  };
  
  // Function to apply transit layer visibility
  const applyTransitLayerVisibility = (isVisible) => {
    if (!map.current || !map.current.loaded()) return;
    
    try {
      console.log(`Transit layer toggle: ${isVisible ? 'ON' : 'OFF'}`);
      
      // Transit layers will now focus only on rail/subway
      if (isVisible) {
        // Check if we already have transit layers
        if (!map.current.getLayer('transit-rail-lines')) {
          console.log("Adding transit layers...");
          
          // Make sure the style is fully loaded
          if (!map.current.isStyleLoaded()) {
            console.log("Style not fully loaded, waiting...");
            setTimeout(() => applyTransitLayerVisibility(isVisible), 200);
            return;
          }
          
          // Rail lines
          map.current.addLayer({
            id: 'transit-rail-lines',
            type: 'line',
            source: 'composite',
            'source-layer': 'road',
            filter: ['all', ['==', ['get', 'class'], 'major_rail']],
            paint: {
              'line-color': '#8c4799',
              'line-width': 2
            }
          });
          
          // Rail stations (exclude bus stations)
          map.current.addLayer({
            id: 'transit-stations',
            type: 'circle',
            source: 'composite',
            'source-layer': 'poi_label',
            filter: [
              'any',
              ['==', ['get', 'type'], 'Railway Station'],
              ['==', ['get', 'type'], 'Subway Station']
            ],
            paint: {
              'circle-radius': 5,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#8c4799',
              'circle-stroke-width': 2
            }
          });
          
          // Rail station labels (exclude bus stations)
          map.current.addLayer({
            id: 'transit-station-labels',
            type: 'symbol',
            source: 'composite',
            'source-layer': 'poi_label',
            filter: [
              'any',
              ['==', ['get', 'type'], 'Railway Station'],
              ['==', ['get', 'type'], 'Subway Station']
            ],
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Regular'],
              'text-size': 11,
              'text-offset': [0, 1.5],
              'text-anchor': 'top'
            },
            paint: {
              'text-color': '#8c4799',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1
            }
          });
          
          // Track for cleanup
          mapFeaturesRef.current.layers['transit-rail-lines'] = true;
          mapFeaturesRef.current.layers['transit-stations'] = true;
          mapFeaturesRef.current.layers['transit-station-labels'] = true;
          
          console.log("Transit layers added successfully");
        } else {
          // Just set visibility to visible if layers already exist
          console.log("Setting existing transit layers to visible");
          map.current.setLayoutProperty('transit-rail-lines', 'visibility', 'visible');
          map.current.setLayoutProperty('transit-stations', 'visibility', 'visible');
          map.current.setLayoutProperty('transit-station-labels', 'visibility', 'visible');
        }
      } else {
        // Hide layers
        console.log("Hiding transit layers");
        if (map.current.getLayer('transit-rail-lines')) {
          map.current.setLayoutProperty('transit-rail-lines', 'visibility', 'none');
        }
        if (map.current.getLayer('transit-stations')) {
          map.current.setLayoutProperty('transit-stations', 'visibility', 'none');
        }
        if (map.current.getLayer('transit-station-labels')) {
          map.current.setLayoutProperty('transit-station-labels', 'visibility', 'none');
        }
      }
      
      // Update the legend
      updateTransitLegend(isVisible);
      
    } catch (error) {
      console.error('Error toggling transit layers:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
  };
  
  // Function to apply traffic layer visibility
  const applyTrafficLayerVisibility = (isVisible) => {
    if (!map.current || !map.current.loaded()) return;
    
    try {
      if (isVisible) {
        // Add traffic source if not exists
        if (!map.current.getSource('mapbox-traffic')) {
          map.current.addSource('mapbox-traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1'
          });
          
          // Add traffic layer
          map.current.addLayer({
            id: 'traffic-layer',
            type: 'line',
            source: 'mapbox-traffic',
            'source-layer': 'traffic',
            paint: {
              'line-width': 2,
              'line-color': [
                'match',
                ['get', 'congestion'],
                'low', '#84b356',
                'moderate', '#f8c967',
                'heavy', '#e55e5e',
                'severe', '#8b0000',
                '#000000'
              ]
            }
          });
          
          // Track for cleanup
          mapFeaturesRef.current.sources['mapbox-traffic'] = true;
          mapFeaturesRef.current.layers['traffic-layer'] = true;
        } else {
          // Just set visibility to visible
          map.current.setLayoutProperty('traffic-layer', 'visibility', 'visible');
        }
      } else {
        // Hide layer
        if (map.current.getLayer('traffic-layer')) {
          map.current.setLayoutProperty('traffic-layer', 'visibility', 'none');
        }
      }
    } catch (error) {
      console.error('Error toggling traffic layer:', error);
    }
  };
  
  // Function to apply 3D buildings visibility
  const applyBuildings3DVisibility = (isVisible) => {
    if (!map.current || !map.current.loaded()) return;
    
    try {
      if (isVisible) {
        // Add 3D buildings layer
        if (!map.current.getLayer('3d-buildings')) {
          // Add fill extrusion layer for buildings
          map.current.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                14, 0,
                16, ['get', 'height']
              ],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.6
            }
          });
          
          // Track for cleanup
          mapFeaturesRef.current.layers['3d-buildings'] = true;
        } else {
          // Just set visibility to visible
          map.current.setLayoutProperty('3d-buildings', 'visibility', 'visible');
        }
        
        // Change pitch for better 3D view
        map.current.easeTo({
          pitch: 45,
          duration: 1000
        });
      } else {
        // Hide layer
        if (map.current.getLayer('3d-buildings')) {
          map.current.setLayoutProperty('3d-buildings', 'visibility', 'none');
        }
        
        // Reset pitch
        map.current.easeTo({
          pitch: 0,
          duration: 1000
        });
      }
    } catch (error) {
      console.error('Error toggling 3D buildings:', error);
    }
  };

  // Function to fetch bus routes from backend
  const fetchBusRoutes = async () => {
    if (busDataLoaded && busRoutesData) return; // Don't fetch again if already loaded
    
    try {
      setBusDataLoading(true);
      
      // Show loading indicator
      const loadingMessage = document.createElement('div');
      loadingMessage.id = 'bus-loading-indicator';
      loadingMessage.className = 'loading-indicator';
      loadingMessage.innerHTML = '<span>Loading bus routes...</span>';
      map.current.getContainer().appendChild(loadingMessage);
      
      console.log("Fetching bus routes from backend for", city);
      
      const response = await fetch(`http://localhost:5000/bus-routes?city=${encodeURIComponent(city)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch bus routes: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Bus routes data received:", data);
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setBusRoutesData(data);
      setBusDataLoaded(true);
      
      // Remove loading indicator
      const indicator = document.getElementById('bus-loading-indicator');
      if (indicator) indicator.remove();
      
      return data;
    } catch (error) {
      console.error("Error fetching bus routes:", error);
      
      // Update loading indicator to show error
      const indicator = document.getElementById('bus-loading-indicator');
      if (indicator) {
        indicator.innerHTML = `<span style="color:#ff6b6b">Error: ${error.message}</span>`;
        setTimeout(() => indicator.remove(), 3000);
      }
      
      throw error;
    } finally {
      setBusDataLoading(false);
    }
  };

  // Create a function to generate unique colors for bus routes
  const generateRouteColor = (routeRef) => {
    // Define a set of colors to cycle through
    const colors = [
      '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', 
      '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
      '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', 
      '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
    ];
    
    // Use the route reference to select a color
    if (!routeRef) return colors[0]; // Default color
    
    // Create a simple hash of the route ref to select a color
    let hash = 0;
    for (let i = 0; i < routeRef.length; i++) {
      hash = routeRef.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Function to display bus routes on the map
  const displayBusRoutes = (data) => {
    if (!map.current || !map.current.loaded() || !data) return;
    
    try {
      console.log("Displaying bus routes and stops on map...");
      
      // Add bus routes source if it doesn't exist
      if (!map.current.getSource('bus-routes-source')) {
        map.current.addSource('bus-routes-source', {
          type: 'geojson',
          data: data.routes
        });
      } else {
        map.current.getSource('bus-routes-source').setData(data.routes);
      }
      
      // Add bus stops source if it doesn't exist
      if (!map.current.getSource('bus-stops-source')) {
        map.current.addSource('bus-stops-source', {
          type: 'geojson',
          data: data.stops
        });
      } else {
        map.current.getSource('bus-stops-source').setData(data.stops);
      }
      
      // Add bus routes layer if it doesn't exist
      if (!map.current.getLayer('bus-routes-layer')) {
        map.current.addLayer({
          id: 'bus-routes-layer',
          type: 'line',
          source: 'bus-routes-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': 'visible'
          },
          paint: {
            'line-color': ['string', ['case',
              ['has', 'ref'], ['concat', '#', ['format', ['get', 'ref'], {}]],
              '#888888'
            ]],
            'line-width': 3,
            'line-opacity': 0.8
          }
        });
        
        // Track for cleanup
        mapFeaturesRef.current.layers['bus-routes-layer'] = true;
      }
      
      // Add bus route labels
      if (!map.current.getLayer('bus-route-labels')) {
        map.current.addLayer({
          id: 'bus-route-labels',
          type: 'symbol',
          source: 'bus-routes-source',
          layout: {
            'text-field': ['get', 'ref'],
            'text-font': ['Open Sans Bold'],
            'text-size': 12,
            'symbol-placement': 'line',
            'text-offset': [0, -0.5],
            'text-anchor': 'center',
            'text-justify': 'center',
            'visibility': 'visible',
            'text-allow-overlap': false,
            'text-ignore-placement': false
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': ['string', ['case',
              ['has', 'ref'], ['concat', '#', ['format', ['get', 'ref'], {}]],
              '#888888'
            ]],
            'text-halo-width': 2
          }
        });
        
        mapFeaturesRef.current.layers['bus-route-labels'] = true;
      }
      
      // Add bus stops layer if it doesn't exist
      if (!map.current.getLayer('bus-stops-layer')) {
        map.current.addLayer({
          id: 'bus-stops-layer',
          type: 'circle',
          source: 'bus-stops-source',
          layout: {
            'visibility': 'visible'
          },
          paint: {
            'circle-radius': 4,
            'circle-color': '#ffffff',
            'circle-stroke-color': '#4a89dc',
            'circle-stroke-width': 2
          }
        });
        
        // Track for cleanup
        mapFeaturesRef.current.layers['bus-stops-layer'] = true;
      }
      
      // Add bus stop labels
      if (!map.current.getLayer('bus-stops-labels')) {
        map.current.addLayer({
          id: 'bus-stops-labels',
          type: 'symbol',
          source: 'bus-stops-source',
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Regular'],
            'text-size': 10,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
            'text-max-width': 8,
            'visibility': 'visible',
            'text-allow-overlap': false,
            'text-ignore-placement': true
          },
          paint: {
            'text-color': '#4a89dc',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1
          }
        });
        
        // Track for cleanup
        mapFeaturesRef.current.layers['bus-stops-labels'] = true;
      }
      
      // Set up interactions for bus stops
      setupBusLayerInteractions();
      
      // Create color-matched legend for bus routes
      createBusRoutesLegend(data.routes);
      
      console.log("Bus routes displayed successfully");
    } catch (error) {
      console.error("Error displaying bus routes:", error);
      throw error;
    }
  };

  // Function to create a dynamic legend showing bus route numbers
  const createBusRoutesLegend = (routesData) => {
    // Remove existing legend
    const existingLegend = document.querySelector('.bus-routes-legend');
    if (existingLegend) existingLegend.remove();
    
    // Get unique route references
    const routeRefs = new Set();
    routesData.features.forEach(feature => {
      const ref = feature.properties.ref;
      if (ref) routeRefs.add(ref);
    });
    
    // Sort route numbers numerically if possible
    const sortedRefs = Array.from(routeRefs).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      return (isNaN(numA) || isNaN(numB)) ? a.localeCompare(b) : numA - numB;
    });
    
    // Only show legend if we have routes
    if (sortedRefs.length === 0) return;
    
    // Create legend container
    const legend = document.createElement('div');
    legend.className = 'bus-routes-legend visible';
    
    // Create legend title
    const title = document.createElement('div');
    title.className = 'legend-title';
    title.textContent = 'Bus Routes';
    legend.appendChild(title);
    
    // Create scrollable container for route items
    const routesContainer = document.createElement('div');
    routesContainer.className = 'routes-container';
    
    // Add route items (limit to 10, with "and X more" if needed)
    const maxRoutesToShow = 10;
    const routesToShow = sortedRefs.slice(0, maxRoutesToShow);
    
    routesToShow.forEach(ref => {
      const color = generateRouteColor(ref);
      
      const item = document.createElement('div');
      item.className = 'legend-item';
      
      const colorSwatch = document.createElement('div');
      colorSwatch.className = 'legend-line';
      colorSwatch.style.backgroundColor = color;
      
      const label = document.createElement('div');
      label.className = 'legend-label';
      label.textContent = `Route ${ref}`;
      
      item.appendChild(colorSwatch);
      item.appendChild(label);
      routesContainer.appendChild(item);
    });
    
    // If there are more routes than we're showing
    if (sortedRefs.length > maxRoutesToShow) {
      const moreItem = document.createElement('div');
      moreItem.className = 'legend-more';
      moreItem.textContent = `+ ${sortedRefs.length - maxRoutesToShow} more routes`;
      routesContainer.appendChild(moreItem);
    }
    
    legend.appendChild(routesContainer);
    
    // Add a section for bus stops
    const stopsSection = document.createElement('div');
    stopsSection.className = 'legend-section';
    
    const stopsItem = document.createElement('div');
    stopsItem.className = 'legend-item';
    
    const stopIcon = document.createElement('div');
    stopIcon.className = 'legend-circle';
    stopIcon.style.backgroundColor = 'white';
    stopIcon.style.border = '2px solid #4a89dc';
    
    const stopLabel = document.createElement('div');
    stopLabel.className = 'legend-label';
    stopLabel.textContent = 'Bus Stop';
    
    stopsItem.appendChild(stopIcon);
    stopsItem.appendChild(stopLabel);
    stopsSection.appendChild(stopsItem);
    
    legend.appendChild(stopsSection);
    
    // Add the legend to the map
    map.current.getContainer().appendChild(legend);
  };

  // Update the bus routes visibility function
  const applyBusRoutesVisibility = (isVisible) => {
    if (!map.current || !map.current.loaded()) return;
    
    try {
      console.log(`Bus routes toggle: ${isVisible ? 'ON' : 'OFF'}`);
      
      if (isVisible) {
        // If data isn't loaded yet, fetch it
        if (!busDataLoaded && !busDataLoading) {
          console.log("Bus data not loaded, fetching now...");
          
          fetchBusRoutes()
            .then(data => {
              // Display the data on the map
              displayBusRoutes(data);
            })
            .catch(error => {
              console.error("Error loading bus routes:", error);
            });
        } else if (busDataLoaded && busRoutesData) {
          // Just show the layers if already loaded
          map.current.setLayoutProperty('bus-routes-layer', 'visibility', 'visible');
          map.current.setLayoutProperty('bus-route-labels', 'visibility', 'visible');
          map.current.setLayoutProperty('bus-stops-layer', 'visibility', 'visible');
          map.current.setLayoutProperty('bus-stops-labels', 'visibility', 'visible');
          
          // Show the legend
          const legend = document.querySelector('.bus-routes-legend');
          if (legend) legend.classList.add('visible');
          else createBusRoutesLegend(busRoutesData.routes);
        }
      } else {
        // Hide layers
        if (map.current.getLayer('bus-routes-layer')) {
          map.current.setLayoutProperty('bus-routes-layer', 'visibility', 'none');
        }
        if (map.current.getLayer('bus-route-labels')) {
          map.current.setLayoutProperty('bus-route-labels', 'visibility', 'none');
        }
        if (map.current.getLayer('bus-stops-layer')) {
          map.current.setLayoutProperty('bus-stops-layer', 'visibility', 'none');
        }
        if (map.current.getLayer('bus-stops-labels')) {
          map.current.setLayoutProperty('bus-stops-labels', 'visibility', 'none');
        }
        
        // Hide the legend
        const legend = document.querySelector('.bus-routes-legend');
        if (legend) legend.classList.remove('visible');
      }
    } catch (error) {
      console.error('Error toggling bus route layers:', error);
    }
  };

  // Set up interactions for bus layers
  const setupBusLayerInteractions = () => {
    // Click handler for bus stops
    map.current.on('click', 'bus-stops-layer', (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const coordinates = feature.geometry.coordinates.slice();
        const properties = feature.properties;
        
        // Create popup content
        const popupHTML = `
          <div class="popup-content">
            <h3 class="popup-title">${properties.name || 'Bus Stop'}</h3>
            <div class="info-row">
              <span>Type</span>
              <span>Bus Stop</span>
            </div>
            ${properties.shelter !== 'unknown' ? `
            <div class="info-row">
              <span>Shelter</span>
              <span>${properties.shelter}</span>
            </div>` : ''}
            ${properties.bench !== 'unknown' ? `
            <div class="info-row">
              <span>Bench</span>
              <span>${properties.bench}</span>
            </div>` : ''}
          </div>
        `;
        
        // Create and display popup
        new mapboxgl.Popup({
          offset: [0, -10],
          className: 'bus-stop-popup'
        })
        .setLngLat(coordinates)
        .setHTML(popupHTML)
        .addTo(map.current);
      }
    });
    
    // Click handler for bus routes
    map.current.on('click', 'bus-routes-layer', (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const properties = feature.properties;
        
        // Create popup content
        const popupHTML = `
          <div class="popup-content">
            <h3 class="popup-title">Bus ${properties.ref || ''}</h3>
            <div class="info-row">
              <span>Route</span>
              <span>${properties.name || 'Unnamed'}</span>
            </div>
            <div class="info-row">
              <span>Operator</span>
              <span>${properties.operator || 'Unknown'}</span>
            </div>
          </div>
        `;
        
        // Create and display popup
        new mapboxgl.Popup({
          offset: [0, 0],
          className: 'bus-route-popup'
        })
        .setLngLat(e.lngLat)
        .setHTML(popupHTML)
        .addTo(map.current);
      }
    });
    
    // Change cursor on hover
    map.current.on('mouseenter', 'bus-stops-layer', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    
    map.current.on('mouseleave', 'bus-stops-layer', () => {
      map.current.getCanvas().style.cursor = '';
    });
    
    map.current.on('mouseenter', 'bus-routes-layer', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });
    
    map.current.on('mouseleave', 'bus-routes-layer', () => {
      map.current.getCanvas().style.cursor = '';
    });
  };

  // useEffect for map initialization
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
      
      // Add layer control (custom control)
      map.current.on('load', () => {
        // Create layer controls container
        const layerControlContainer = document.createElement('div');
        layerControlContainer.className = 'layer-control-container';
        
        // Create individual toggle controls
        const transitToggle = createToggleControl('Railways', 'transit', layersVisible.transit, toggleMapLayer);
        const busRoutesToggle = createToggleControl('Bus Routes', 'busRoutes', layersVisible.busRoutes, toggleMapLayer);
        const trafficToggle = createToggleControl('Traffic', 'traffic', layersVisible.traffic, toggleMapLayer);
        const buildings3dToggle = createToggleControl('3D Buildings', 'buildings3d', layersVisible.buildings3d, toggleMapLayer);
        
        // Add the controls to the container
        layerControlContainer.appendChild(transitToggle);
        layerControlContainer.appendChild(busRoutesToggle);
        layerControlContainer.appendChild(trafficToggle);
        layerControlContainer.appendChild(buildings3dToggle);
        
        // Add the container to the map
        const mapCanvas = map.current.getCanvasContainer();
        mapCanvas.parentNode.appendChild(layerControlContainer);

        // Add a debug button
        const debugButton = document.createElement('button');
        debugButton.innerText = 'Debug Map';
        debugButton.className = 'map-debug-button';
        debugButton.addEventListener('click', () => {
          console.log("Debug button clicked");
          
          // Log map status
          console.log("Map loaded:", map.current.loaded());
          console.log("Style loaded:", map.current.isStyleLoaded());
          
          // Show a simple test layer
          try {
            // Add a simple point to verify layer adding works
            if (!map.current.getSource('debug-source')) {
              map.current.addSource('debug-source', {
                'type': 'geojson',
                'data': {
                  'type': 'Feature',
                  'geometry': {
                    'type': 'Point',
                    'coordinates': [map.current.getCenter().lng, map.current.getCenter().lat]
                  },
                  'properties': {
                    'title': 'Debug Point'
                  }
                }
              });
              
              map.current.addLayer({
                'id': 'debug-layer',
                'type': 'circle',
                'source': 'debug-source',
                'paint': {
                  'circle-radius': 10,
                  'circle-color': '#FF0000'
                }
              });
              
              // Show success notification
              const notification = document.createElement('div');
              notification.className = 'map-notification';
              notification.textContent = 'Debug layer created successfully';
              notification.style.backgroundColor = '#4CAF50';
              map.current.getContainer().appendChild(notification);
              
              setTimeout(() => {
                notification.remove();
              }, 3000);
            } else {
              // Toggle visibility
              const currentVisibility = map.current.getLayoutProperty('debug-layer', 'visibility');
              const newVisibility = currentVisibility === 'visible' ? 'none' : 'visible';
              map.current.setLayoutProperty('debug-layer', 'visibility', newVisibility);
              
              // Show toggle notification
              const notification = document.createElement('div');
              notification.className = 'map-notification';
              notification.textContent = `Debug layer ${newVisibility === 'visible' ? 'shown' : 'hidden'}`;
              map.current.getContainer().appendChild(notification);
              
              setTimeout(() => {
                notification.remove();
              }, 1500);
            }
          } catch (error) {
            console.error("Debug layer error:", error);
            
            // Show error notification
            const notification = document.createElement('div');
            notification.className = 'map-notification map-notification-error';
            notification.textContent = `Error: ${error.message}`;
            map.current.getContainer().appendChild(notification);
            
            setTimeout(() => {
              notification.remove();
            }, 3000);
          }
        });
        
        map.current.getContainer().appendChild(debugButton);
      });
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

// Helper function to create a toggle control with better feedback
function createToggleControl(label, type, isActive, toggleFn) {
  const controlContainer = document.createElement('div');
  controlContainer.className = 'layer-control';
  
  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  labelElement.className = 'layer-control-label';
  
  const toggleButton = document.createElement('button');
  toggleButton.className = `layer-toggle ${isActive ? 'active' : ''}`;
  toggleButton.textContent = isActive ? 'ON' : 'OFF';
  toggleButton.setAttribute('data-type', type); // Add a data attribute to help identify the button
  
  toggleButton.addEventListener('click', () => {
    console.log(`Button clicked: ${type}`);
    
    // Visual feedback
    toggleButton.classList.add('clicking');
    setTimeout(() => toggleButton.classList.remove('clicking'), 200);
    
    // Toggle state
    const newState = !toggleButton.classList.contains('active');
    if (newState) {
      toggleButton.classList.add('active');
      toggleButton.textContent = 'ON';
    } else {
      toggleButton.classList.remove('active');
      toggleButton.textContent = 'OFF';
    }
    
    // Call the toggle function
    toggleFn(type);
  });
  
  controlContainer.appendChild(labelElement);
  controlContainer.appendChild(toggleButton);
  
  return controlContainer;
}

export default MapView; 