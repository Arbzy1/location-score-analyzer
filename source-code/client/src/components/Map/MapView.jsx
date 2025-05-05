import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapView.css';
import { getDirections } from '../../services/osrmService';
import { getPostcodeAmenities } from '../../services/amenityService';
import { API_URL } from '../../utils/api';

// Set Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export const MapView = ({ city = 'Cardiff, UK', locations = [], savedLocations = [], savedPostcodes = [], recommendations = [] }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const recommendationMarkersRef = useRef([]);  // Separate ref for recommendation markers
  const savedLocationMarkersRef = useRef([]);  // Initialize as empty array
  const amenityMarkersRef = useRef([]); // New ref for amenity markers
  const markersRef = useRef({
    saved: [],
    recommendations: []
  });
  const savedPostcodeMarkers = useRef([]);
  const travelPreferenceMarkers = useRef([]); // New ref for travel preference markers

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

  // Add this to your component to store consistent colors for route numbers
  const routeColorCache = useRef({});

  // Add new state for routing
  const [routingMode, setRoutingMode] = useState(false);
  const [selectedStartMarker, setSelectedStartMarker] = useState(null);
  const [selectedEndMarker, setSelectedEndMarker] = useState(null);

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
          icon: icon,
          isTopSchool: type.toLowerCase() === 'school' && amenity.is_top_rated,
          rank: amenity.rank,
          rating: amenity.rating,
          schoolType: amenity.school_type
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
          
          let popupContent = `
            <div class="popup-content amenity-popup">
              <h3 class="popup-title">${properties.icon} ${properties.name}</h3>
              <p>Type: ${properties.type}</p>
              <p>Distance: ${properties.distance}m</p>
              ${properties.isTopSchool ? 
                `<p class="top-school-badge ${properties.schoolType || 'unknown'}-school" style="margin-top:8px;display:inline-block;">
                  ${properties.schoolType === "primary" ? '🏫' : '🎓'} 
                  ${properties.rank <= 3 ? '🥇' : properties.rank <= 10 ? '🥈' : '🌟'} 
                  Rank ${properties.rank} ${properties.schoolType === "primary" ? "Primary" : "Secondary"} School
                </p>
                <p>Rating: ${properties.rating}</p>` 
                : ''}
            </div>
          `;
          
          // Create a popup
          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(popupContent)
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
  const fetchBusRoutes = async (city) => {
    try {
      const response = await fetch(`${API_URL}/bus-routes?city=${encodeURIComponent(city)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Bus routes data received:", data);
      return data;
    } catch (error) {
      console.error("Error fetching bus routes:", error);
      throw error;
    }
  };

  // Update the displayBusRoutes function with proper color handling and zoom-dependent visibility
  const displayBusRoutes = (data) => {
    if (!map.current || !map.current.loaded() || !data) {
        console.warn("Map or data not ready for bus routes display");
        return;
    }
    
    try {
        console.log("Displaying bus routes and stops on map...");
        
        // Validate the data structure
        if (!data.routes?.features || !data.stops?.features) {
            console.error("Invalid bus route data structure:", data);
            return;
        }
        
        // Create a mapping of route refs to colors for consistency
        const routeColors = {};
        data.routes.features.forEach(feature => {
            if (feature.properties?.ref) {
                if (!routeColors[feature.properties.ref]) {
                    routeColors[feature.properties.ref] = generateRouteColor(feature.properties.ref);
                }
            }
        });
        
        // Remove existing sources and layers if they exist
        ['bus-routes-source', 'bus-stops-source'].forEach(sourceId => {
            if (map.current.getSource(sourceId)) {
                ['bus-routes-layer', 'bus-route-labels', 'bus-stops-layer', 'bus-stops-labels'].forEach(layerId => {
                    if (map.current.getLayer(layerId)) {
                        map.current.removeLayer(layerId);
                    }
                });
                map.current.removeSource(sourceId);
            }
        });
        
        // Add bus routes source
        map.current.addSource('bus-routes-source', {
            type: 'geojson',
            data: data.routes
        });
        
        // Add bus stops source
        map.current.addSource('bus-stops-source', {
            type: 'geojson',
            data: data.stops
        });
        
        // Add bus routes layer
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
                'line-color': [
                    'case',
                    ['has', 'ref'],
                    [
                        'match',
                        ['get', 'ref'],
                        ...Object.entries(routeColors).flatMap(([ref, color]) => [ref, color]),
                        '#888888'
                    ],
                    '#888888'
                ],
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 1,
                    15, 3
                ],
                'line-opacity': 0.8
            }
        });
        
        // Add bus route labels with improved visibility rules
        map.current.addLayer({
            id: 'bus-route-labels',
            type: 'symbol',
            source: 'bus-routes-source',
            layout: {
                'text-field': ['coalesce', ['get', 'ref'], ['get', 'name'], ''],
                'text-font': ['Open Sans Bold'],
                'symbol-placement': 'line',
                'text-offset': [0, -0.5],
                'text-anchor': 'center',
                'text-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 0,
                    12, 10,
                    14, 12
                ],
                'text-max-angle': 30,
                'symbol-spacing': 250,
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'visibility': 'visible'
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': [
                    'case',
                    ['has', 'ref'],
                    [
                        'match',
                        ['get', 'ref'],
                        ...Object.entries(routeColors).flatMap(([ref, color]) => [ref, color]),
                        '#888888'
                    ],
                    '#888888'
                ],
                'text-halo-width': 2
            }
        });
        
        // Add bus stops layer with improved visibility
        map.current.addLayer({
            id: 'bus-stops-layer',
            type: 'circle',
            source: 'bus-stops-source',
            minzoom: 14,
            layout: {
                'visibility': 'visible'
            },
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 2,
                    16, 4,
                    18, 6
                ],
                'circle-color': '#ffffff',
                'circle-stroke-color': '#4a89dc',
                'circle-stroke-width': 2,
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0.5,
                    16, 1.0
                ]
            }
        });
        
        // Add bus stop labels with improved visibility
        map.current.addLayer({
            id: 'bus-stops-labels',
            type: 'symbol',
            source: 'bus-stops-source',
            minzoom: 15,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Regular'],
                'text-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15, 0,
                    16, 8,
                    18, 10
                ],
                'text-offset': [0, 1.2],
                'text-anchor': 'top',
                'text-max-width': 8,
                'visibility': 'visible'
            },
            paint: {
                'text-color': '#4a89dc',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5,
                'text-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15, 0,
                    16, 0.7,
                    17, 1.0
                ]
            }
        });
        
        // Track layers for cleanup
        mapFeaturesRef.current.layers['bus-routes-layer'] = true;
        mapFeaturesRef.current.layers['bus-route-labels'] = true;
        mapFeaturesRef.current.layers['bus-stops-layer'] = true;
        mapFeaturesRef.current.layers['bus-stops-labels'] = true;
        
        // Create legend with zoom-responsive info
        createBusRoutesLegend(data.routes, routeColors);
        
        console.log("Bus routes displayed successfully");
        
    } catch (error) {
        console.error("Error displaying bus routes:", error);
        console.error("Error stack:", error.stack);
    }
  };

  // Function to update bus stop visibility info in legend
  const updateBusStopLegendInfo = () => {
    if (!map.current) return;
    
    const legend = document.querySelector('.bus-routes-legend');
    if (!legend) return;
    
    const currentZoom = Math.floor(map.current.getZoom());
    const stopsInfo = legend.querySelector('.bus-stops-zoom-info');
    
    if (!stopsInfo) {
      // Create info element if it doesn't exist
      const stopsSection = legend.querySelector('.legend-section');
      if (stopsSection) {
        const info = document.createElement('div');
        info.className = 'bus-stops-zoom-info';
        stopsSection.appendChild(info);
      }
    }
    
    // Update zoom info text
    const infoElement = legend.querySelector('.bus-stops-zoom-info');
    if (infoElement) {
      if (currentZoom < 14) {
        infoElement.textContent = 'Zoom in to see bus stops';
        infoElement.style.color = '#999';
      } else if (currentZoom < 15) {
        infoElement.textContent = 'Zoom in more to see stop names';
        infoElement.style.color = '#777';
      } else {
        infoElement.textContent = 'Bus stops visible';
        infoElement.style.color = '#4a89dc';
      }
    }
  };

  // Update the createBusRoutesLegend function for better positioning and styling
  const createBusRoutesLegend = (routesData, routeColors) => {
    // Remove existing legend
    const existingLegend = document.querySelector('.bus-routes-legend');
    if (existingLegend) existingLegend.remove();
    
    // Get unique route references
    const routeRefs = Object.keys(routeColors);
    
    // Only show legend if we have routes
    if (routeRefs.length === 0) return;
    
    // Sort route numbers numerically if possible
    const sortedRefs = routeRefs.sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      return (isNaN(numA) || isNaN(numB)) ? a.localeCompare(b) : numA - numB;
    });
    
    // Create legend container
    const legend = document.createElement('div');
    legend.className = 'bus-routes-legend visible';
    
    // Add inline styles for positioning
    legend.style.position = 'absolute';
    legend.style.bottom = '30px';
    legend.style.right = '10px';
    legend.style.backgroundColor = 'white';
    legend.style.borderRadius = '6px';
    legend.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.2)';
    legend.style.padding = '10px';
    legend.style.maxWidth = '250px';
    legend.style.maxHeight = '300px';
    legend.style.overflow = 'hidden';
    legend.style.zIndex = '999';
    legend.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    
    // Create legend title
    const title = document.createElement('div');
    title.className = 'legend-title';
    title.textContent = 'Bus Routes';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.style.paddingBottom = '4px';
    title.style.borderBottom = '1px solid #eee';
    legend.appendChild(title);
    
    // Create scrollable container for route items
    const routesContainer = document.createElement('div');
    routesContainer.className = 'routes-container';
    routesContainer.style.maxHeight = '200px';
    routesContainer.style.overflowY = 'auto';
    routesContainer.style.paddingRight = '5px';
    routesContainer.style.marginBottom = '8px';
    
    // Add route items (limit to 10, with "and X more" if needed)
    const maxRoutesToShow = 10;
    const routesToShow = sortedRefs.slice(0, maxRoutesToShow);
    
    routesToShow.forEach(ref => {
      const color = routeColors[ref];
      
      // Get proper route name from data if available
      let routeName = '';
      if (routesData && routesData.features) {
        const routeFeature = routesData.features.find(f => 
          f.properties && f.properties.ref === ref
        );
        
        if (routeFeature && routeFeature.properties) {
          // Use route name if available, otherwise use ref with route prefix
          routeName = routeFeature.properties.name || 
                     (routeFeature.properties.from && routeFeature.properties.to ? 
                     `${routeFeature.properties.from} - ${routeFeature.properties.to}` : 
                     `Route ${ref}`);
        }
      }
      
      // If we couldn't find a proper name, just use the ref
      if (!routeName) routeName = `Route ${ref}`;
      
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.marginBottom = '5px';
      item.style.fontSize = '12px';
      
      const colorSwatch = document.createElement('div');
      colorSwatch.className = 'legend-line';
      colorSwatch.style.width = '20px';
      colorSwatch.style.height = '4px';
      colorSwatch.style.marginRight = '8px';
      colorSwatch.style.borderRadius = '2px';
      colorSwatch.style.backgroundColor = color;
      
      const label = document.createElement('div');
      label.className = 'legend-label';
      label.style.flex = '1';
      label.style.whiteSpace = 'nowrap';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.textContent = routeName;
      
      item.appendChild(colorSwatch);
      item.appendChild(label);
      routesContainer.appendChild(item);
    });
    
    // If there are more routes than we're showing
    if (sortedRefs.length > maxRoutesToShow) {
      const moreItem = document.createElement('div');
      moreItem.className = 'legend-more';
      moreItem.style.fontSize = '11px';
      moreItem.style.color = '#666';
      moreItem.style.fontStyle = 'italic';
      moreItem.style.marginTop = '5px';
      moreItem.textContent = `+ ${sortedRefs.length - maxRoutesToShow} more routes`;
      routesContainer.appendChild(moreItem);
    }
    
    legend.appendChild(routesContainer);
    
    // Add a section for bus stops
    const stopsSection = document.createElement('div');
    stopsSection.className = 'legend-section';
    stopsSection.style.borderTop = '1px solid #eee';
    stopsSection.style.paddingTop = '8px';
    stopsSection.style.marginTop = '5px';
    
    const stopsItem = document.createElement('div');
    stopsItem.className = 'legend-item';
    stopsItem.style.display = 'flex';
    stopsItem.style.alignItems = 'center';
    stopsItem.style.marginBottom = '5px';
    stopsItem.style.fontSize = '12px';
    
    const stopIcon = document.createElement('div');
    stopIcon.className = 'legend-circle';
    stopIcon.style.width = '10px';
    stopIcon.style.height = '10px';
    stopIcon.style.borderRadius = '50%';
    stopIcon.style.marginRight = '8px';
    stopIcon.style.backgroundColor = 'white';
    stopIcon.style.border = '2px solid #4a89dc';
    
    const stopLabel = document.createElement('div');
    stopLabel.className = 'legend-label';
    stopLabel.style.flex = '1';
    stopLabel.textContent = 'Bus Stop';
    
    stopsItem.appendChild(stopIcon);
    stopsItem.appendChild(stopLabel);
    stopsSection.appendChild(stopsItem);
    
    // Add zoom info element
    const zoomInfo = document.createElement('div');
    zoomInfo.className = 'bus-stops-zoom-info';
    zoomInfo.textContent = 'Zoom in to see bus stops';
    zoomInfo.style.fontSize = '11px';
    zoomInfo.style.color = '#999';
    zoomInfo.style.fontStyle = 'italic';
    zoomInfo.style.marginTop = '4px';
    stopsSection.appendChild(zoomInfo);
    
    legend.appendChild(stopsSection);
    
    // Add the legend directly to the map container's parent
    const mapContainer = map.current.getContainer();
    mapContainer.appendChild(legend);
  };

  // Function to update bus routes visibility
  const applyBusRoutesVisibility = async (isVisible) => {
    try {
      console.log(`Bus routes toggle: ${isVisible ? 'ON' : 'OFF'}`);
      
      if (isVisible) {
        if (busRoutesData) {
          // Use cached data if available
          console.log("Using cached bus routes data");
          displayBusRoutes(busRoutesData);
        } else {
          // Fetch new data if not cached
          console.log("Bus data not loaded, fetching now...");
          if (city) {
            const cityName = city.split(',')[0].trim();
            console.log(`Fetching bus routes from backend for ${cityName}`);
            const data = await fetchBusRoutes(cityName);
            setBusRoutesData(data); // Cache the data
            displayBusRoutes(data);
          }
        }
      } else {
        // Hide bus routes and stops
        removeBusRoutes();
      }
    } catch (error) {
      console.error("Error toggling bus routes:", error);
    }
  };

  // Add this function to clean up bus routes
  const removeBusRoutes = () => {
    if (!map.current) return;
    
    // Remove layers
    ['bus-routes-layer', 'bus-route-labels', 'bus-stops-layer', 'bus-stops-labels'].forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
        delete mapFeaturesRef.current.layers[layerId];
      }
    });
    
    // Remove sources
    ['bus-routes-source', 'bus-stops-source'].forEach(sourceId => {
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });
    
    // Remove legend
    const legend = document.querySelector('.bus-routes-legend');
    if (legend) legend.remove();
    
    // Remove event handlers
    if (map.current.listenerCount('zoom', updateBusStopLegendInfo)) {
      map.current.off('zoom', updateBusStopLegendInfo);
    }
  };

  // Update the useEffect to clear cached data when the city changes
  useEffect(() => {
    if (city) {
      // Clear cached bus routes data when city changes
      setBusRoutesData(null);
      
      // If bus routes are currently visible, turn them off
      if (layersVisible.busRoutes) {
        setLayersVisible(prev => ({ ...prev, busRoutes: false }));
        removeBusRoutes();
      }
    }
  }, [city]);

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
      
      // Add click handler to close popups when clicking on the map
      map.current.on('click', (e) => {
        // Check if click was on a marker (in which case we don't want to close popups)
        const clickedOnMarker = e.originalEvent.target.closest('.recommendation-marker, .saved-location-marker, .amenity-marker');
        if (!clickedOnMarker) {
          // Close all popups
          const popups = document.querySelectorAll('.mapboxgl-popup');
          popups.forEach(popup => {
            // Find the close button and click it
            const closeButton = popup.querySelector('.mapboxgl-popup-close-button');
            if (closeButton) {
              closeButton.click();
            }
          });
        }
      });
      
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
          anchor: 'top',
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
              <div class="routing-buttons">
                <button class="set-start-btn" data-lat="${location.lat}" data-lon="${location.lon}">Set as Start Point</button>
                <button class="set-end-btn" data-lat="${location.lat}" data-lon="${location.lon}">Set as End Point</button>
              </div>
              ${selectedStartMarker || selectedEndMarker ? `
                <button class="clear-route-btn">Clear Route</button>
              ` : ''}
            </div>
          </div>
        `);

        // Add recommendation marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([location.lon, location.lat])
          .setPopup(popup)
          .addTo(map.current);

        // Add event listeners to the popup buttons after popup is open
        marker.getPopup().on('open', () => {
          // Clear other amenity markers when a new popup is opened
          clearAmenityMarkers();
          
          setTimeout(() => {
            // Show Amenities button handler
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

            // Set Start Point button handler
            const setStartBtn = document.querySelector('.set-start-btn');
            if (setStartBtn) {
              setStartBtn.addEventListener('click', () => {
                const lat = parseFloat(setStartBtn.dataset.lat);
                const lon = parseFloat(setStartBtn.dataset.lon);
                if (selectedStartMarker) {
                  selectedStartMarker.marker.getElement().style.border = '';
                }
                setSelectedStartMarker({ marker, coords: { lat, lon } });
                marker.getElement().style.border = '3px solid #ff0000';
                marker.getPopup().remove(); // Close the popup after selecting
              });
            }

            // Set End Point button handler
            const setEndBtn = document.querySelector('.set-end-btn');
            if (setEndBtn) {
              setEndBtn.addEventListener('click', () => {
                const lat = parseFloat(setEndBtn.dataset.lat);
                const lon = parseFloat(setEndBtn.dataset.lon);
                if (selectedEndMarker) {
                  selectedEndMarker.marker.getElement().style.border = '';
                }
                setSelectedEndMarker({ marker, coords: { lat, lon } });
                marker.getElement().style.border = '3px solid #00ff00';
                
                // If we have both start and end points, get the route
                if (selectedStartMarker) {
                  displayRoute(
                    [selectedStartMarker.coords.lat, selectedStartMarker.coords.lon],
                    [lat, lon]
                  ).catch(error => {
                    console.error('Error getting directions:', error);
                    clearRoute();
                  });
                }
                marker.getPopup().remove(); // Close the popup after selecting
              });
            }

            // Clear Route button handler
            const clearRouteBtn = document.querySelector('.clear-route-btn');
            if (clearRouteBtn) {
              clearRouteBtn.addEventListener('click', () => {
                clearRoute();
                marker.getPopup().remove(); // Close the popup after clearing
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
        offset: 25,
        className: 'custom-popup'
      })
      .setHTML(`
        <div class="popup-content">
          <h3>${location.label}</h3>
          <p>${location.postcode}</p>
          <div class="popup-actions">
            <button class="show-amenities-btn">Show Amenities on Map</button>
            <a href="https://www.google.com/maps?q=${location.latitude},${location.longitude}" target="_blank" rel="noopener noreferrer" class="maps-link">
              View on Google Maps
            </a>
            <div class="routing-buttons">
              <button class="set-start-btn" data-lat="${location.latitude}" data-lon="${location.longitude}">Set as Start Point</button>
              <button class="set-end-btn" data-lat="${location.latitude}" data-lon="${location.longitude}">Set as End Point</button>
            </div>
            ${selectedStartMarker || selectedEndMarker ? `
              <button class="clear-route-btn">Clear Route</button>
            ` : ''}
          </div>
        </div>
      `);

      // Add marker with popup
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'bottom',
        offset: [0, 0]
      })
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map.current);

      // Add event listeners to the popup buttons after popup is open
      marker.getPopup().on('open', () => {
        setTimeout(() => {
          // Show Amenities button handler
          const showAmenitiesBtn = document.querySelector('.show-amenities-btn');
          if (showAmenitiesBtn) {
            showAmenitiesBtn.addEventListener('click', async () => {
              if (!location.amenities || Object.keys(location.amenities).length === 0) {
                try {
                  // Fetch amenities for the postcode
                  const amenities = await getPostcodeAmenities(location.postcode);
                  if (amenities && Object.keys(amenities).length > 0) {
                    // Update the location object with the new amenities
                    location.amenities = amenities;
                    // Add amenity markers to the map
                    addAmenityMarkers(amenities, {lon: location.longitude, lat: location.latitude});
                  } else {
                    console.warn("No amenities data available for this location");
                    alert("No amenity data available for this location");
                  }
                } catch (error) {
                  console.error("Error fetching amenities:", error);
                  alert("Failed to fetch amenities for this location");
                }
              } else {
                // Use existing amenities data
                addAmenityMarkers(location.amenities, {lon: location.longitude, lat: location.latitude});
              }
            });
          }

          // Set Start Point button handler
          const setStartBtn = document.querySelector('.set-start-btn');
          if (setStartBtn) {
            setStartBtn.addEventListener('click', () => {
              const lat = parseFloat(setStartBtn.dataset.lat);
              const lon = parseFloat(setStartBtn.dataset.lon);
              if (selectedStartMarker) {
                selectedStartMarker.marker.getElement().style.border = '';
              }
              setSelectedStartMarker({ marker, coords: { lat, lon } });
              marker.getElement().style.border = '3px solid #ff0000';
              marker.getPopup().remove(); // Close the popup after selecting
            });
          }

          // Set End Point button handler
          const setEndBtn = document.querySelector('.set-end-btn');
          if (setEndBtn) {
            setEndBtn.addEventListener('click', () => {
              const lat = parseFloat(setEndBtn.dataset.lat);
              const lon = parseFloat(setEndBtn.dataset.lon);
              if (selectedEndMarker) {
                selectedEndMarker.marker.getElement().style.border = '';
              }
              setSelectedEndMarker({ marker, coords: { lat, lon } });
              marker.getElement().style.border = '3px solid #00ff00';
              
              // If we have both start and end points, get the route
              if (selectedStartMarker) {
                displayRoute(
                  [selectedStartMarker.coords.lat, selectedStartMarker.coords.lon],
                  [lat, lon]
                ).catch(error => {
                  console.error('Error getting directions:', error);
                  clearRoute();
                });
              }
              marker.getPopup().remove(); // Close the popup after selecting
            });
          }

          // Clear Route button handler
          const clearRouteBtn = document.querySelector('.clear-route-btn');
          if (clearRouteBtn) {
            clearRouteBtn.addEventListener('click', () => {
              clearRoute();
              marker.getPopup().remove(); // Close the popup after clearing
            });
          }
        }, 100);
      });

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

  // Update saved postcode markers
  useEffect(() => {
    if (!map.current || !savedPostcodes) return;

    console.log("Updating saved postcode markers:", savedPostcodes);

    // Remove existing markers
    if (savedPostcodeMarkers.current) {
      savedPostcodeMarkers.current.forEach(marker => marker.remove());
      savedPostcodeMarkers.current = [];
    }

    // Process both saved postcodes and travel preferences
    const allLocations = [...savedPostcodes];
    
    allLocations.forEach(location => {
      // Log each location for debugging
      console.log("Processing location:", location);

      // Check for both formats of coordinates (lat/lng and latitude/longitude)
      const latitude = location.lat || location.latitude;
      const longitude = location.lng || location.longitude;

      if (!latitude || !longitude) {
        console.warn("Missing coordinates for location:", location);
        return;
      }

      // Create marker element with different styling for travel preferences
      const markerElement = document.createElement('div');
      markerElement.className = location.transportMode ? 'travel-preference-marker' : 'saved-location-marker';
      
      // Create popup with different content based on type
      const popup = new mapboxgl.Popup({ 
        offset: 25,
        className: 'custom-popup'
      })
      .setHTML(`
        <div class="popup-content">
          <h3>${location.label || location.type || 'Saved Location'}</h3>
          <p>${location.postcode}</p>
          ${location.transportMode ? `
            <p>Transport: ${location.transportMode}</p>
            <p>Frequency: ${location.frequency} times/week</p>
          ` : ''}
          <div class="popup-actions">
            <button class="show-amenities-btn">Show Amenities on Map</button>
            <a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank" rel="noopener noreferrer" class="maps-link">
              View on Google Maps
            </a>
            <div class="routing-buttons">
              <button class="set-start-btn" data-lat="${latitude}" data-lon="${longitude}">Set as Start Point</button>
              <button class="set-end-btn" data-lat="${latitude}" data-lon="${longitude}">Set as End Point</button>
            </div>
            ${selectedStartMarker || selectedEndMarker ? `
              <button class="clear-route-btn">Clear Route</button>
            ` : ''}
          </div>
        </div>
      `);

      // Create and add marker
      const marker = new mapboxgl.Marker({
        element: markerElement,
        anchor: 'bottom',
        offset: [0, 0]
      })
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map.current);

      // Add event listeners to the popup buttons after popup is open
      marker.getPopup().on('open', () => {
        setTimeout(() => {
          const showAmenitiesBtn = document.querySelector('.show-amenities-btn');
          const mapsLink = document.querySelector('.maps-link');
          const setStartBtn = document.querySelector('.set-start-btn');
          const setEndBtn = document.querySelector('.set-end-btn');
          const clearRouteBtn = document.querySelector('.clear-route-btn');

          if (showAmenitiesBtn) {
            showAmenitiesBtn.addEventListener('click', () => {
              showAmenitiesForPostcode(location.postcode);
            });
          }

          if (mapsLink) {
            mapsLink.addEventListener('click', () => {
              window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
            });
          }

          if (setStartBtn) {
            setStartBtn.addEventListener('click', () => {
              if (selectedStartMarker) {
                selectedStartMarker.marker.getElement().style.border = '';
              }
              setSelectedStartMarker({ marker, coords: { lat: latitude, lon: longitude } });
              marker.getElement().style.border = '3px solid #ff0000';
              marker.getPopup().remove();
            });
          }

          if (setEndBtn) {
            setEndBtn.addEventListener('click', () => {
              if (selectedEndMarker) {
                selectedEndMarker.marker.getElement().style.border = '';
              }
              setSelectedEndMarker({ marker, coords: { lat: latitude, lon: longitude } });
              marker.getElement().style.border = '3px solid #00ff00';
              
              if (selectedStartMarker) {
                displayRoute(
                  [selectedStartMarker.coords.lat, selectedStartMarker.coords.lon],
                  [latitude, longitude]
                ).catch(error => {
                  console.error('Error getting directions:', error);
                  clearRoute();
                });
              }
              marker.getPopup().remove();
            });
          }

          if (clearRouteBtn) {
            clearRouteBtn.addEventListener('click', () => {
              clearRoute();
              marker.getPopup().remove();
            });
          }
        }, 100);
      });

      savedPostcodeMarkers.current.push(marker);
    });

    // If we have markers, fit the map to show them all
    if (savedPostcodeMarkers.current.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      savedPostcodeMarkers.current.forEach(marker => {
        bounds.extend(marker.getLngLat());
      });
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }
  }, [map.current, savedPostcodes]);

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

  // Update the generateRouteColor function to use the cache
  const generateRouteColor = (routeRef) => {
    // Check if we already have a color for this route
    if (routeColorCache.current[routeRef]) {
      return routeColorCache.current[routeRef];
    }
    
    // Simple hash function to generate a deterministic color from route number/name
    let hash = 0;
    for (let i = 0; i < routeRef.length; i++) {
      hash = routeRef.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to hex format and ensure it's a valid 6-digit hex color
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    
    // Store in cache for future use
    routeColorCache.current[routeRef] = color;
    return color;
  };

  // Add new function to handle route display
  const displayRoute = async (startCoords, endCoords) => {
    try {
      console.log('Fetching route for:', { startCoords, endCoords });
      const routeData = await getDirections(startCoords, endCoords);
      console.log('Route data received:', routeData);

      if (!routeData || !routeData.features || !routeData.features.length) {
        console.error('Invalid route data received');
        return;
      }

      // Remove existing route if present
      if (map.current.getSource('route')) {
        map.current.removeLayer('route-layer');
        map.current.removeSource('route');
      }

      // Add the route source
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeData.features[0].geometry
        }
      });

      // Add the route layer
      map.current.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3887be',
          'line-width': 5,
          'line-opacity': 0.75
        }
      });

      // Fit the map to show the entire route
      const coordinates = routeData.features[0].geometry.coordinates;
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

      map.current.fitBounds(bounds, {
        padding: 50,
        duration: 1000
      });

    } catch (error) {
      console.error('Error displaying route:', error);
    }
  };

  // Update the handleMarkerClick function
  const handleMarkerClick = (marker, coords) => {
    if (!routingMode) {
      // If not in routing mode, just show the popup
      marker.togglePopup();
      return;
    }

    if (!selectedStartMarker) {
      setSelectedStartMarker({ marker, coords });
      marker.getElement().style.border = '3px solid #ff0000';
      marker.getPopup().remove(); // Close popup after selecting
    } else if (!selectedEndMarker) {
      setSelectedEndMarker({ marker, coords });
      marker.getElement().style.border = '3px solid #00ff00';
      
      // Get directions between the points
      displayRoute(
        [selectedStartMarker.coords.lat, selectedStartMarker.coords.lon],
        [coords.lat, coords.lon]
      ).catch(error => {
        console.error('Error getting directions:', error);
        clearRoute();
      });
      marker.getPopup().remove(); // Close popup after selecting
    }
  };

  // Add a clear route function
  const clearRoute = () => {
    // Remove route from map
    if (map.current.getSource('route')) {
      map.current.removeLayer('route-layer');
      map.current.removeSource('route');
    }

    // Reset marker styles
    if (selectedStartMarker) {
      selectedStartMarker.marker.getElement().style.border = '';
    }
    if (selectedEndMarker) {
      selectedEndMarker.marker.getElement().style.border = '';
    }

    // Reset state
    setSelectedStartMarker(null);
    setSelectedEndMarker(null);
  };

  return (
    <div className="map-container">
      <div ref={mapContainer} className="map" />
      <div className="map-controls">
        {/* ... existing controls ... */}
        
        {/* Add route controls */}
        <div className="routing-controls">
          <button 
            onClick={() => {
              setRoutingMode(!routingMode);
              if (!routingMode) {
                clearRoute();
              }
            }}
            className={`control-button ${routingMode ? 'active' : ''}`}
          >
            {routingMode ? 'Cancel Routing' : 'Get Directions'}
          </button>
          {routingMode && (
            <button 
              onClick={clearRoute}
              className="control-button"
            >
              Clear Route
            </button>
          )}
        </div>
      </div>
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