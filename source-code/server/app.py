from flask import Flask, request, jsonify
from flask_cors import CORS
import osmnx as ox
import geopandas as gpd
import random
from shapely.geometry import Point
from shapely.ops import transform
import pyproj
from functools import lru_cache
import math
import requests
import os
import time
import pandas as pd
import json

app = Flask(__name__)
CORS(app)

print("Server: Starting up Flask application...")
ox.settings.use_cache = False
ox.settings.log_console = True

def get_nearest_amenity(pt, gdf):
    """Find the nearest amenity and its distance from a point."""
    if gdf.empty:
        return None, None
        
    transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    pt_proj = transform(transformer.transform, pt)
    min_distance = None
    nearest_row = None
    
    for idx, row in gdf.iterrows():
        geom = row.geometry
        amenity_proj = transform(transformer.transform, geom)
        d = pt_proj.distance(amenity_proj)
        if min_distance is None or d < min_distance:
            min_distance = d
            nearest_row = row
    return min_distance, nearest_row

def generate_random_points(polygon, num_points):
    """Generate random points within a polygon"""
    points = []
    minx, miny, maxx, maxy = polygon.bounds
    attempts = 0
    max_attempts = num_points * 20

    while len(points) < num_points and attempts < max_attempts:
        random_point = Point(
            random.uniform(minx, maxx),
            random.uniform(miny, maxy)
        )
        if polygon.contains(random_point):
            points.append(random_point)
        attempts += 1

    print(f"✅ Generated {len(points)} points after {attempts} attempts")
    return points

def haversine(coord1, coord2):
    """Calculate distance between two coordinates."""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371000  # Earth radius in meters

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi/2)**2 + \
        math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2*R*math.asin(math.sqrt(a))

def find_nearest_area(lat, lon, areas):
    """Find the nearest area name for a location."""
    if not areas:
        return "Unknown Area"
        
    min_dist = None
    nearest_area = None
    
    for area in areas:
        d = haversine((lat, lon), (area["lat"], area["lon"]))
        if min_dist is None or d < min_dist:
            min_dist = d
            nearest_area = area
    
    return nearest_area["name"] if nearest_area else "Unknown Area"

def get_area_names(bbox):
    """Get area names within a bounding box."""
    print("🏘️ Retrieving area names...")
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    area_query = f"""
    [out:json][timeout:30];
    (
      node["place"~"^(suburb|neighbourhood|quarter|town|city|village|hamlet)$"]({bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]});
      way["place"~"^(suburb|neighbourhood|quarter|town|city|village|hamlet)$"]({bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]});
      relation["place"~"^(suburb|neighbourhood|quarter|town|city|village|hamlet)$"]({bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]});
    );
    out center;
    """
    
    try:
        print(f"Fetching areas within bounding box: {bbox}")
        response = requests.get(overpass_url, params={'data': area_query}, timeout=30)
        print(f"Area response status: {response.status_code}")
        
        if response.status_code != 200:
            return []
            
        data = response.json()
        areas = []
        
        for elem in data.get("elements", []):
            if "tags" in elem and "name" in elem["tags"]:
                area_name = elem["tags"]["name"]
                if "lat" in elem and "lon" in elem:
                    areas.append({
                        "name": area_name,
                        "lat": elem["lat"],
                        "lon": elem["lon"]
                    })
                elif "center" in elem:
                    areas.append({
                        "name": area_name,
                        "lat": elem["center"]["lat"],
                        "lon": elem["center"]["lon"]
                    })
                    
        print(f"Found {len(areas)} areas: {[area['name'] for area in areas]}")
        return areas
        
    except Exception as e:
        print(f"⚠️ Error retrieving area names: {e}")
        return []

def analyze_location(city):
    print(f"🔍 Starting analysis for {city}...")
    
    try:
        # Get city boundary
        city_gdf = ox.geocode_to_gdf(city)
        if city_gdf.empty:
            print(f"❌ Could not retrieve boundary for {city}")
            return []

        city_polygon = city_gdf.unary_union
        print("✅ City boundary retrieved successfully")

        # Generate points
        print("🎲 Generating random points...")
        num_candidates = 20
        candidate_points = generate_random_points(city_polygon, num_candidates)
        print(f"✅ Generated {len(candidate_points)} candidate points")

        # Get amenities
        print("🏫 Retrieving amenities...")
        schools = ox.features_from_place(city, {"amenity": "school"})
        print("✅ Schools retrieved")
        
        hospitals = ox.features_from_place(city, {"amenity": "hospital"})
        print("✅ Hospitals retrieved")
        
        supermarkets = ox.features_from_place(city, {"shop": "supermarket"})
        print("✅ Supermarkets retrieved")

        # Get area names
        areas = get_area_names(city_gdf.total_bounds)

        # Process locations
        print("📊 Processing amenity data...")
        locations = []
        
        for pt in candidate_points:
            location_data = {
                "lat": pt.y,
                "lon": pt.x,
                "category": "Recommended Location",
                "amenities": {},
                "score": 0
            }
            
            total_score = 0
            amenities_data = {
                "school": (schools, 1000, 0.4),
                "hospital": (hospitals, 2000, 0.5),
                "supermarket": (supermarkets, 1000, 0.3)
            }
            
            for a_type, (gdf, threshold, weight) in amenities_data.items():
                if not gdf.empty:
                    distance, nearest = get_nearest_amenity(pt, gdf)
                    if distance is not None:
                        score = weight * (threshold - distance) / threshold if distance < threshold else 0
                        total_score += score
                        
                        # Add coordinates of the amenity to the response
                        # Get centroid for any geometry type
                        if nearest is not None and nearest.geometry is not None:
                            # Extract centroid coordinates - works for both Points and Polygons
                            centroid = nearest.geometry.centroid
                            location_data["amenities"][a_type] = {
                                "name": nearest.get("name", "Unnamed"),
                                "distance": int(distance),
                                "lat": centroid.y,  # Use centroid coordinates
                                "lon": centroid.x   # Use centroid coordinates
                            }
                        else:
                            location_data["amenities"][a_type] = {
                                "name": nearest.get("name", "Unnamed"),
                                "distance": int(distance)
                            }
            
            location_data["score"] = round(total_score * 100, 1)
            location_data["area_name"] = find_nearest_area(pt.y, pt.x, areas)
            location_data["google_maps_link"] = f"https://www.google.com/maps?q={pt.y},{pt.x}"
            
            locations.append(location_data)

        # Sort and return top locations
        locations.sort(key=lambda x: x["score"], reverse=True)
        top_locations = locations[:5]
        
        print(f"✅ Analysis complete for {city}")
        print(f"📊 Final results: {len(locations)} locations processed")
        
        print("\nTop 3 locations preview:")
        for idx, loc in enumerate(top_locations[:3]):
            print(f"\nLocation {idx + 1}:")
            print(f"Score: {loc['score']}")
            print(f"Area: {loc['area_name']}")
            print(f"Coordinates: {loc['lat']}, {loc['lon']}")
            print("Amenities:", list(loc['amenities'].keys()))
        
        return top_locations

    except Exception as e:
        print(f"❌ Error in analyze_location: {str(e)}\n")
        return []

@app.route('/amenities', methods=['GET', 'OPTIONS'])
def get_amenities():
    if request.method == 'OPTIONS':
        return '', 204
        
    print("\n🚀 Server: Starting new request processing...")
    city = request.args.get('city', "Cardiff, UK")
    print(f"📍 Processing request for city: {city}")
    
    try:
        locations = analyze_location(city)
        
        response_data = {
            "city": city,
            "locations": locations
        }
        
        print("📤 Sending response to client")
        return jsonify(response_data)
    except Exception as e:
        print(f"❌ Server Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/bus-routes', methods=['GET'])
def get_bus_routes():
    city = request.args.get('city', 'Cardiff, UK')
    
    try:
        print(f"🚌 Fetching bus routes for {city} using Overpass API...")
        
        # Extract city name without country
        city_name = city.split(',')[0].strip()
        
        # Create Overpass QL query for bus routes
        overpass_query = f"""
        [out:json][timeout:60];
        area["name"="{city_name}"]->.searchArea;
        (
          relation["route"="bus"](area.searchArea);
        );
        out body;
        >;
        out skel qt;
        """
        
        # Create Overpass QL query for bus stops
        bus_stops_query = f"""
        [out:json][timeout:30];
        area["name"="{city_name}"]->.searchArea;
        (
          node["highway"="bus_stop"](area.searchArea);
        );
        out body;
        """
        
        # Send request to Overpass API for routes
        overpass_url = "https://overpass-api.de/api/interpreter"
        
        print("Sending bus routes query to Overpass API...")
        routes_response = requests.post(overpass_url, data=overpass_query, timeout=60)
        
        if routes_response.status_code != 200:
            print(f"Error from Overpass API: {routes_response.status_code}")
            return jsonify({"error": "Failed to fetch bus routes from Overpass API"}), 500
        
        routes_data = routes_response.json()
        print(f"Received {len(routes_data.get('elements', []))} elements from Overpass for bus routes")
        
        # Send request for bus stops
        print("Sending bus stops query to Overpass API...")
        stops_response = requests.post(overpass_url, data=bus_stops_query, timeout=30)
        
        if stops_response.status_code != 200:
            print(f"Error from Overpass API: {stops_response.status_code}")
            return jsonify({"error": "Failed to fetch bus stops from Overpass API"}), 500
        
        stops_data = stops_response.json()
        print(f"Received {len(stops_data.get('elements', []))} elements from Overpass for bus stops")
        
        # Process the raw OSM data into a usable format
        print("Processing bus route data...")
        processed_data = process_bus_routes(routes_data, stops_data)
        
        return jsonify(processed_data)
        
    except Exception as e:
        print(f"❌ Error fetching bus routes: {str(e)}")
        return jsonify({"error": str(e)}), 500

def process_bus_routes(routes_data, stops_data):
    """Process raw OSM data into structured GeoJSON for rendering"""
    print("Starting to process OSM data into GeoJSON...")
    
    # Process bus stops first
    bus_stops = {
        "type": "FeatureCollection",
        "features": []
    }
    
    stops_by_id = {}  # For quick lookup when processing routes
    
    for element in stops_data.get('elements', []):
        if element['type'] == 'node' and element.get('tags', {}).get('highway') == 'bus_stop':
            stop_id = element['id']
            stop_name = element.get('tags', {}).get('name', f"Bus Stop {stop_id}")
            
            # Create GeoJSON feature for this stop
            feature = {
                "type": "Feature",
                "id": stop_id,
                "properties": {
                    "id": stop_id,
                    "name": stop_name,
                    "type": "bus_stop",
                    "bench": element.get('tags', {}).get('bench', 'unknown'),
                    "shelter": element.get('tags', {}).get('shelter', 'unknown')
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [element['lon'], element['lat']]
                }
            }
            
            bus_stops["features"].append(feature)
            stops_by_id[stop_id] = feature
    
    print(f"Processed {len(bus_stops['features'])} bus stops")
    
    # Now process the routes
    bus_routes = {
        "type": "FeatureCollection",
        "features": []
    }
    
    # Store nodes and ways for lookup
    nodes = {}
    ways = {}
    
    # First pass: collect all nodes and ways
    for element in routes_data.get('elements', []):
        if element['type'] == 'node':
            nodes[element['id']] = element
        elif element['type'] == 'way':
            ways[element['id']] = element
    
    # Second pass: process relations (bus routes)
    for element in routes_data.get('elements', []):
        if element['type'] == 'relation' and element.get('tags', {}).get('route') == 'bus':
            relation_id = element['id']
            route_name = element.get('tags', {}).get('name', '')
            route_ref = element.get('tags', {}).get('ref', '')
            route_operator = element.get('tags', {}).get('operator', 'Unknown')
            
            print(f"Processing bus route: {route_ref} - {route_name}")
            
            # Create a feature for this route
            route_feature = {
                "type": "Feature",
                "id": relation_id,
                "properties": {
                    "id": relation_id,
                    "name": route_name,
                    "ref": route_ref,
                    "type": "bus_route",
                    "operator": route_operator
                },
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": []
                }
            }
            
            # Find all ways that are part of this route
            route_ways = []
            for member in element.get('members', []):
                if member['type'] == 'way' and member['role'] == '':
                    if member['ref'] in ways:
                        route_ways.append(ways[member['ref']])
            
            # For each way, get the node coordinates to form the route geometry
            for way in route_ways:
                way_coords = []
                for node_id in way.get('nodes', []):
                    if node_id in nodes:
                        node = nodes[node_id]
                        way_coords.append([node['lon'], node['lat']])
                
                if way_coords:
                    route_feature["geometry"]["coordinates"].append(way_coords)
            
            # Only add routes with actual geometry
            if route_feature["geometry"]["coordinates"]:
                bus_routes["features"].append(route_feature)
    
    print(f"Processed {len(bus_routes['features'])} bus routes")
    
    # Return both datasets
    return {
        "routes": bus_routes,
        "stops": bus_stops
    }

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
