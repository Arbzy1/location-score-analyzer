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
    print(f"🔄 Travel preferences received: {travel_preferences}")
    
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

        # Get amenity weights from travel preferences or use defaults
        amenity_weights = {
            "school": 15,
            "hospital": 15,
            "supermarket": 10
        }
        
        if travel_preferences and 'amenityWeights' in travel_preferences:
            print("Using custom amenity weights:", travel_preferences['amenityWeights'])
            # Convert string percentages to integers if needed
            amenity_weights = {
                k: int(str(v).replace('%', '')) if isinstance(v, str) else int(v)
                for k, v in travel_preferences['amenityWeights'].items()
            }
            print("Processed amenity weights:", amenity_weights)
            
        # Calculate the total weight of amenities
        total_amenity_weight = sum(amenity_weights.values())
        print(f"Total amenity weight: {total_amenity_weight}%")
        
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
                "travel_scores": {},  # For storing travel times and scores
                "transit": {
                    "score": 0,
                    "accessible_routes": []
                }
            }
            
            # Calculate amenity scores with proper weighting
            amenity_score = 0
            amenity_breakdown = {}
            
            # Process amenities
            amenities_data = {
                "school": (schools, 1000),      # 1km threshold
                "hospital": (hospitals, 2000),   # 2km threshold
                "supermarket": (supermarkets, 1000)  # 1km threshold
            }

            # Only process amenities with non-zero weights
            for a_type, (gdf, threshold) in amenities_data.items():
                weight = amenity_weights.get(a_type, 0)
                if weight > 0 and not gdf.empty:  # Only process if weight > 0
                    distance, nearest = get_nearest_amenity(pt, gdf)
                    if distance is not None:
                        # Calculate normalized score (0-1) for this amenity
                        distance_km = distance / 1000
                        if a_type == "school":
                            score = max(0, 1 - (distance_km / 2))  # 2km reference
                        elif a_type == "hospital":
                            score = max(0, 1 - (distance_km / 3))  # 3km reference
                        else:  # supermarket
                            score = max(0, 1 - (distance_km / 1))  # 1km reference
                            
                        # Calculate weighted score
                        weighted_score = score * weight
                        amenity_score += weighted_score
                        
                        # Store the amenity data and its score
                        if nearest is not None and nearest.geometry is not None:
                            centroid = nearest.geometry.centroid
                            location_data["amenities"][a_type] = {
                                "name": nearest.get("name", "Unnamed"),
                                "distance": int(distance),
                                "lat": centroid.y,
                                "lon": centroid.x,
                                "weight": weight,
                                "score": weighted_score
                            }
                        else:
                            location_data["amenities"][a_type] = {
                                "name": nearest.get("name", "Unnamed"),
                                "distance": int(distance),
                                "weight": weight,
                                "score": weighted_score
                            }
                        
                        # Store score breakdown
                        amenity_breakdown[a_type] = {
                            "weight": weight,
                            "score": weighted_score,
                            "max_score": weight  # Store the maximum possible score
                        }

            # Calculate transit score (20% weight)
            transit_score = gtfs_service.calculate_transit_score(pt.y, pt.x)
            transit_weighted_score = (transit_score / 100) * 20
            
            # Initialize transit data
            location_data["transit"] = {
                "score": transit_score,
                "accessible_routes": gtfs_service.get_route_accessibility(pt.y, pt.x)
            }

            # Calculate travel score (40% weight) if travel preferences exist
            travel_score = 0
            if travel_preferences and 'locations' in travel_preferences:
                print("Processing travel preferences for location:", travel_preferences['locations'])
                total_penalty = 0
                total_frequency = sum(loc["frequency"] for loc in travel_preferences['locations'])
                
                for pref in travel_preferences['locations']:
                    try:
                        print(f"🔍 DEBUG: Processing travel preference: {pref}")
                        coords = get_coordinates_from_postcode(pref["postcode"])
                        if coords:
                            travel_time = calculate_travel_time(
                                (pt.y, pt.x),
                                (coords["lat"], coords["lon"]),
                                mode='car'
                            )
                            
                            if travel_time is not None:
                                print(f"🔍 DEBUG: Travel time calculated for {pref['postcode']}: {travel_time} mins")
                                print(f"🔍 DEBUG: Type from preference: {pref['type']}")
                                
                                # Ensure type is properly set with a default if missing
                                pref_type = pref.get('type', 'Home')
                                print(f"🔍 DEBUG: Type from preference: {pref_type}")
                                
                                # Create a unique key that includes both type and postcode
                                key = f"{pref_type}-{pref['postcode']}"
                                location_data["travel_scores"][key] = {
                                    "travel_time": travel_time,
                                    "frequency": pref["frequency"],
                                    "transport_mode": "driving",
                                    "type": pref_type,  # Use the validated type
                                    "postcode": pref["postcode"]  # Store postcode for reference
                                }
                                print(f"🔍 DEBUG: Stored travel score: {location_data['travel_scores'][key]}")
                                
                                weight = pref["frequency"] / total_frequency
                                trip_penalty = weight * travel_time
                                total_penalty += trip_penalty
                    except Exception as e:
                        print(f"Error calculating travel score for {pref['postcode']}: {str(e)}")
                        continue
                
                max_acceptable_time = 120
                travel_score = max(0, (max_acceptable_time - total_penalty) / max_acceptable_time) * 40
                print(f"Final travel score: {travel_score}")

            # Calculate final score based on active components
            active_weight = sum(weight for weight in amenity_weights.values() if weight > 0)
            if active_weight == 0:
                # If no amenity weights, distribute score between transit and travel
                if travel_preferences and 'locations' in travel_preferences:
                    final_score = travel_score + transit_weighted_score
                    # No scaling needed as these already sum to 60
                else:
                    final_score = transit_weighted_score
                    # No scaling needed as this is already out of 20
            else:
                # Normal case with amenity weights
                final_score = amenity_score + transit_weighted_score + travel_score
                # No scaling needed as these already sum to 100 (40 + 20 + 40)

            # Store score breakdown
            location_data["score_breakdown"] = {
                "amenities": {
                    "total": amenity_score,
                    "breakdown": amenity_breakdown,
                    "weights": amenity_weights
                },
                "transit": {
                    "score": transit_weighted_score,
                    "raw_score": transit_score
                },
                "travel": travel_score
            }
            
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
            
            # Only show amenities with non-zero weights
            active_amenities = [a for a in loc['amenities'].keys() if amenity_weights[a] > 0]
            print("Amenities:", active_amenities)
            
            print(f"Transit Score: {loc['transit']['score']}")
            print(f"Accessible Routes: {len(loc['transit']['accessible_routes'])}")
            if 'travel_scores' in loc:
                print("Travel Scores:", loc['travel_scores'])
            print("Score Breakdown:", loc['score_breakdown'])
        
        return top_locations

    except Exception as e:
        print(f"❌ Error in analyze_location: {str(e)}\n")
        return []

def calculate_travel_time(origin, destination, mode='car'):
    """Calculate travel time between two points using ORS."""
    try:
        if mode == 'car':
            profile = 'driving-car'
        elif mode == 'cycle':
            profile = 'cycling-regular'
        elif mode == 'walk':
            profile = 'foot-walking'
        else:
            profile = 'driving-car'  # default to driving
            
        # Format coordinates as lon,lat (ORS expects longitude first)
        start_point = f"{origin[1]},{origin[0]}"
        end_point = f"{destination[1]},{destination[0]}"
        
        url = f"http://192.168.1.162:8080/ors/v2/directions/{profile}?start={start_point}&end={end_point}"
        response = requests.get(url)
        data = response.json()
        
        if data.get("features") and len(data["features"]) > 0:
            # Convert duration from seconds to minutes
            return data["features"][0]["properties"]["segments"][0]["duration"] / 60
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
    travel_preferences_str = request.args.get('travel_preferences')
    
    print(f"📍 Processing request for city: {city}")
    print(f"🔄 Travel preferences received: {travel_preferences_str}")
    
    try:
        # Parse travel preferences if they exist
        travel_preferences = json.loads(travel_preferences_str) if travel_preferences_str else None
        
        locations = analyze_location(city, travel_preferences)
        
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
