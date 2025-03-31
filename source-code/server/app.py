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
from gtfs_service import GTFSService

app = Flask(__name__)
CORS(app)

print("Server: Starting up Flask application...")
ox.settings.use_cache = False
ox.settings.log_console = True

# Initialize GTFS service
gtfs_service = GTFSService()

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

def analyze_location(city, travel_preferences=None):
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
                "score": 0,
                "travel_scores": {}  # New field for travel-related scores
            }
            
            # Initialize scores for each category
            amenity_scores = {
                "school": 0,
                "hospital": 0,
                "supermarket": 0,
                "transit": 0,
                "travel": 0  # New category for travel behavior
            }
            
            # Calculate amenity scores (30% of total)
            amenities_data = {
                "school": (schools, 1000, 0.15),      # 15% weight
                "hospital": (hospitals, 2000, 0.15),   # 15% weight
                "supermarket": (supermarkets, 1000, 0.1)  # 10% weight
            }
            
            for a_type, (gdf, threshold, weight) in amenities_data.items():
                if not gdf.empty:
                    distance, nearest = get_nearest_amenity(pt, gdf)
                    if distance is not None:
                        # Calculate normalized score (0-1) for this amenity
                        amenity_scores[a_type] = max(0, (threshold - distance) / threshold)
                        
                        if nearest is not None and nearest.geometry is not None:
                            centroid = nearest.geometry.centroid
                            location_data["amenities"][a_type] = {
                                "name": nearest.get("name", "Unnamed"),
                                "distance": int(distance),
                                "lat": centroid.y,
                                "lon": centroid.x
                            }
                        else:
                            location_data["amenities"][a_type] = {
                                "name": nearest.get("name", "Unnamed"),
                                "distance": int(distance)
                            }
            
            # Calculate transit score (20% of total)
            transit_score = gtfs_service.calculate_transit_score(pt.y, pt.x) / 100
            amenity_scores["transit"] = transit_score
            
            # Get accessible routes
            accessible_routes = gtfs_service.get_route_accessibility(pt.y, pt.x)
            location_data["transit"] = {
                "score": transit_score * 100,
                "accessible_routes": accessible_routes
            }
            
            # Calculate travel behavior score (40% of total)
            if travel_preferences:
                travel_score = 0
                total_frequency = sum(loc["frequency"] for loc in travel_preferences)
                
                for pref in travel_preferences:
                    try:
                        # Get coordinates from postcode
                        coords = get_coordinates_from_postcode(pref["postcode"])
                        if coords:
                            # Calculate travel time based on transport mode
                            if pref["transportMode"] == "bus":
                                # Use GTFS for bus travel time
                                travel_time = gtfs_service.calculate_transit_time(
                                    pt.y, pt.x, coords["lat"], coords["lon"]
                                )
                            else:
                                # Use OSRM for other modes
                                travel_time = calculate_travel_time(
                                    (pt.y, pt.x),
                                    (coords["lat"], coords["lon"]),
                                    mode=pref["transportMode"]
                                )
                            
                            # Normalize travel time (0-1 score, lower time = higher score)
                            max_acceptable_time = 60  # minutes
                            time_score = max(0, (max_acceptable_time - travel_time) / max_acceptable_time)
                            
                            # Weight by visit frequency
                            weighted_score = time_score * (pref["frequency"] / total_frequency)
                            travel_score += weighted_score
                            
                            # Store travel details
                            location_data["travel_scores"][pref["type"]] = {
                                "travel_time": travel_time,
                                "score": time_score * 100,
                                "transport_mode": pref["transportMode"]
                            }
                    except Exception as e:
                        print(f"Error calculating travel score: {str(e)}")
                        continue
                
                amenity_scores["travel"] = travel_score
            
            # Calculate final weighted score (0-100)
            final_score = (
                amenity_scores["school"] * 15 +       # 15% weight
                amenity_scores["hospital"] * 15 +      # 15% weight
                amenity_scores["supermarket"] * 10 +   # 10% weight
                amenity_scores["transit"] * 20 +       # 20% weight
                (amenity_scores["travel"] * 40 if travel_preferences else 0)  # 40% weight if travel prefs exist
            )
            
            # If no travel preferences, scale up other scores proportionally
            if not travel_preferences:
                final_score = final_score * (100/60)  # Scale up to 100
            
            location_data["score"] = round(final_score, 1)
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
            print(f"Transit Score: {loc['transit']['score']}")
            print(f"Accessible Routes: {len(loc['transit']['accessible_routes'])}")
            if 'travel_scores' in loc:
                print("Travel Scores:", loc['travel_scores'])
        
        return top_locations

    except Exception as e:
        print(f"❌ Error in analyze_location: {str(e)}\n")
        return []

def calculate_travel_time(origin, destination, mode='car'):
    """Calculate travel time between two points using OSRM."""
    try:
        if mode == 'car':
            profile = 'driving'
        elif mode == 'cycle':
            profile = 'cycling'
        elif mode == 'walk':
            profile = 'walking'
        else:
            profile = 'driving'  # default to driving
            
        url = f"http://router.project-osrm.org/route/v1/{profile}/{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
        response = requests.get(url)
        data = response.json()
        
        if data["code"] == "Ok" and len(data["routes"]) > 0:
            # Convert duration from seconds to minutes
            return data["routes"][0]["duration"] / 60
        return None
    except Exception as e:
        print(f"Error calculating travel time: {str(e)}")
        return None

def get_coordinates_from_postcode(postcode):
    """Get coordinates from a UK postcode using postcodes.io API."""
    try:
        url = f"https://api.postcodes.io/postcodes/{postcode}"
        response = requests.get(url)
        data = response.json()
        
        if response.status_code == 200 and data["status"] == 200:
            return {
                "lat": float(data["result"]["latitude"]),
                "lon": float(data["result"]["longitude"])
            }
        return None
    except Exception as e:
        print(f"Error getting coordinates from postcode: {str(e)}")
        return None

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
    try:
        print("🚌 Fetching bus routes from GTFS data...")
        data = gtfs_service.get_routes_geojson()
        print(f"✅ Found {len(data['routes']['features'])} routes and {len(data['stops']['features'])} stops")
        return jsonify(data)
    except Exception as e:
        print(f"❌ Error fetching bus routes: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/bus-routes/<route_id>', methods=['GET'])
def get_route_details(route_id):
    try:
        print(f"🚌 Fetching details for route {route_id}...")
        data = gtfs_service.get_route_details(route_id)
        return jsonify(data)
    except Exception as e:
        print(f"❌ Error fetching route details: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
