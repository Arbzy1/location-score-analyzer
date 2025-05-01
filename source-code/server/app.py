from flask import Flask, request, jsonify
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

print("Server: Starting up Flask application...")
ox.settings.use_cache = False
ox.settings.log_console = True

# Initialize GTFS service
gtfs_service = GTFSService()

# OpenTripPlanner API URL
OTP_API_URL = "http://localhost:8080/otp/routers/default/index/graphql"

@lru_cache(maxsize=128)
def otp_fastest_minutes(origin, destination, dt_iso="2025-05-01T08:00:00+01:00"):
    """Return best door-to-door duration (min) using TRANSIT+WALK or None."""
    lat1, lon1 = origin
    lat2, lon2 = destination
    
    # Use a much simpler query structure that works with most OTP versions
    gql = {
        "query": f"""
        {{
          plan(
            fromPlace: "{lat1},{lon1}"
            toPlace: "{lat2},{lon2}"
            date: "{dt_iso[:10]}"
            time: "{dt_iso[11:19]}"
          ) {{
            itineraries {{
              duration
              legs {{
                mode
                duration
              }}
            }}
          }}
        }}
        """
    }
    
    try:
        print(f"Calling OTP for route from {lat1},{lon1} to {lat2},{lon2}")
        r = requests.post(OTP_API_URL, json=gql, timeout=15).json()
        
        # Print the raw response for debugging
        print(f"OTP response: {r}")
        
        # Bail out cleanly if GraphQL reports errors
        if "errors" in r:
            print("OTP GraphQL error:", r["errors"][0]["message"])
            return None

        plan = r.get("data", {}).get("plan")
        if not plan or not plan.get("itineraries"):
            print("OTP found no transit itinerary")
            return None

        sec = plan["itineraries"][0]["duration"]
        transit_min = sec / 60
        print(f"OTP found transit route: {transit_min:.2f} minutes")
        return transit_min
        
    except Exception as e:
        print("OTP parsing error:", e)
        return None

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('X-Frame-Options', 'SAMEORIGIN')
    
    # Add Content-Security-Policy header to allow Firebase and other necessary services
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
        "https://www.googletagmanager.com https://api.mapbox.com https://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com; "
        "img-src 'self' data: https://api.mapbox.com https://*.firebaseio.com https://*.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com https://use.typekit.net; "
        "connect-src 'self' http://localhost:5000 http://localhost:8080 "
        "https://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com "
        "https://identitytoolkit.googleapis.com https://firestore.googleapis.com "
        "https://api.mapbox.com https://events.mapbox.com "
        "https://api.postcodes.io http://192.168.1.162:8080 https://www.google-analytics.com; "
        "frame-src 'self' https://api.mapbox.com https://*.firebaseio.com https://*.googleapis.com; "
        "worker-src 'self' blob:; "
        "manifest-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'self';"
    )
    response.headers.add('Content-Security-Policy', csp)
    return response

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

        # Get travel mode preference
        travel_mode = 'auto'  # default to auto
        if travel_preferences and 'travelMode' in travel_preferences:
            travel_mode = travel_preferences['travelMode']
            print(f"🚗 Using travel mode from preferences: {travel_mode}")
        else:
            print(f"🚗 Using default travel mode: {travel_mode}")

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
                },
                "transport_modes": {}  # New field for detailed transport mode information
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

            # Round amenity score to 1 decimal place
            amenity_score = round(amenity_score, 1)
            
            # Transit score (20% weight)
            transit_score = gtfs_service.calculate_transit_score(pt.y, pt.x)
            transit_weighted_score = (transit_score / 100) * 20
            # Round transit weighted score to 1 decimal place
            transit_weighted_score = round(transit_weighted_score, 1)
            
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
                
                # Store all transport mode data for each destination
                transport_modes_data = {}
                
                for pref in travel_preferences['locations']:
                    try:
                        print(f"🔍 Processing travel preference: {pref}")
                        coords = get_coordinates_from_postcode(pref["postcode"])
                        if coords:
                            # If a global travel mode is set (not 'auto'), it overrides individual preferences
                            if travel_mode != 'auto':
                                dest_mode = travel_mode
                                print(f"Using global travel mode: {travel_mode} (overriding individual setting)")
                            else:
                                # Get destination mode if specified, otherwise use global mode
                                dest_mode = pref.get('travelMode', travel_mode)
                                print(f"Using destination-specific travel mode: {dest_mode}")
                            
                            # Calculate travel times
                            travel_time = calculate_travel_time(
                                (pt.y, pt.x),
                                (coords["lat"], coords["lon"]),
                                mode=dest_mode
                            )
                            
                            if travel_time is not None:
                                print(f"🔍 Travel time calculated for {pref['postcode']}: {travel_time['duration']} mins")
                                
                                # Ensure type is properly set with a default if missing
                                pref_type = pref.get('type', 'Home')
                                
                                # Create a unique key that includes both type and postcode
                                key = f"{pref_type}-{pref['postcode']}"
                                location_data["travel_scores"][key] = {
                                    "travel_time": travel_time['duration'],
                                    "frequency": pref["frequency"],
                                    "transport_mode": travel_time['mode'],
                                    "all_times": travel_time.get('all_times', {}),
                                    "type": pref_type,
                                    "postcode": pref['postcode']
                                }
                                
                                # Store detailed transport mode information
                                transport_modes_data[key] = {
                                    "selected_mode": travel_time['mode'],
                                    "travel_time_minutes": travel_time['duration'],
                                    "alternative_modes": travel_time.get('all_times', {})
                                }
                                
                                # Also ensure the global mode is explicitly marked as selected when it's used
                                if travel_mode != 'auto':
                                    # Map the global mode to its corresponding API mode
                                    selected_mode_map = {
                                        'driving': 'driving-car',
                                        'cycling': 'cycling-regular',
                                        'walking': 'foot-walking',
                                        'bus': 'bus-transit'
                                    }
                                    if travel_mode in selected_mode_map:
                                        transport_modes_data[key]["selected_mode"] = selected_mode_map[travel_mode]
                                        print(f"Explicitly marking {selected_mode_map[travel_mode]} as selected_mode for {key} due to global preference")
                                
                                # Calculate penalty based on the selected travel mode's time
                                weight = pref["frequency"] / total_frequency
                                
                                # Use the configured travel time which would be the bus time for bus mode
                                # or fastest time for auto mode
                                travel_duration = travel_time['duration']
                                trip_penalty = weight * travel_duration
                                total_penalty += trip_penalty
                                
                                print(f"Using travel time for {travel_time['mode']}: {travel_duration:.2f} mins (weight: {weight}, penalty: {trip_penalty:.2f})")
                    except Exception as e:
                        print(f"Error calculating travel score for {pref['postcode']}: {str(e)}")
                        continue
                
                # Store transport modes data in location data
                location_data["transport_modes"] = transport_modes_data
                
                # Calculate travel score based on weekly travel time (total_penalty is already the weekly total)
                max_acceptable_time = 600  # 10 hours per week (was 120 minutes per day)
                travel_score = max(0, (max_acceptable_time - total_penalty) / max_acceptable_time) * 40
                # Round to 1 decimal place
                travel_score = round(travel_score, 1)
                print(f"Final travel score: {travel_score} (weekly travel time: {total_penalty:.2f} mins)")

            # Calculate final score based on active components
            active_weight = sum(weight for weight in amenity_weights.values() if weight > 0)
            if active_weight == 0:
                # If no amenity weights, distribute score between transit and travel
                if travel_preferences and 'locations' in travel_preferences:
                    final_score = travel_score + transit_weighted_score
                else:
                    final_score = transit_weighted_score
            else:
                # Normal case with amenity weights
                final_score = amenity_score + transit_weighted_score + travel_score

            # Store score breakdown - maintain numerical travel score for backward compatibility
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
                "travel": travel_score,  # Keep this as a number for backward compatibility
                "travel_details": {  # Add details in a separate field
                    "score": travel_score,
                    "mode_preference": travel_mode,
                    "travel_times": location_data["travel_scores"]
                }
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
            
            if loc['travel_scores']:
                print("\nTravel Times:")
                for key, data in loc['travel_scores'].items():
                    print(f"  - {key}: {data['travel_time']:.1f} mins via {data['transport_mode']}")
                    if 'all_times' in data:
                        print(f"    Alternative modes: {data['all_times']}")
            
            print("\nScore Breakdown:", loc['score_breakdown'])
        
        return top_locations

    except Exception as e:
        print(f"❌ Error in analyze_location: {str(e)}\n")
        return []

def ors_minutes(origin, destination, profile):
    """Calculate travel time between two points using ORS."""
    try:
        # Format coordinates as lon,lat (ORS expects longitude first)
        start_point = f"{origin[1]},{origin[0]}"
        end_point = f"{destination[1]},{destination[0]}"
        
        url = f"http://192.168.1.162:8080/ors/v2/directions/{profile}?start={start_point}&end={end_point}"
        response = requests.get(url)
        data = response.json()
        
        if data.get("features") and len(data["features"]) > 0:
            # Convert duration from seconds to minutes
            duration = data["features"][0]["properties"]["segments"][0]["duration"] / 60
            return duration
        return None
    except Exception as e:
        print(f"Error calculating ORS travel time: {str(e)}")
        return None

def calculate_travel_time(origin, destination, mode='auto'):
    """Calculate travel time between two points using ORS or OTP.
    If mode is 'auto', calculates times for all modes and returns the fastest one."""
    try:
        # Format coordinates as lon,lat (ORS expects longitude first)
        start_point = f"{origin[1]},{origin[0]}"
        end_point = f"{destination[1]},{destination[0]}"
        
        if mode == 'auto':
            # Calculate times for all modes
            modes = ['driving-car', 'cycling-regular', 'foot-walking', 'bus-transit']
            times = {}
            
            for transport_mode in modes:
                print(f"Calculating travel time for mode: {transport_mode}")
                if transport_mode == 'bus-transit':
                    duration = otp_fastest_minutes(origin, destination)
                else:
                    duration = ors_minutes(origin, destination, transport_mode)
                    
                if duration:
                    times[transport_mode] = duration
                    print(f"  - {transport_mode}: {duration:.2f} minutes")
                else:
                    print(f"  - {transport_mode}: No route found")
            
            if not times:
                print("No travel times found for any mode")
                return None
                
            # Find the fastest mode
            fastest_mode = min(times.items(), key=lambda x: x[1])
            print(f"Fastest mode: {fastest_mode[0]} ({fastest_mode[1]:.2f} mins)")
            return {
                "duration": fastest_mode[1],
                "mode": fastest_mode[0],
                "all_times": times
            }
        else:
            # Use specific mode
            if mode == 'driving':
                profile = 'driving-car'
                duration = ors_minutes(origin, destination, profile)
            elif mode == 'cycling':
                profile = 'cycling-regular'
                duration = ors_minutes(origin, destination, profile)
            elif mode == 'walking':
                profile = 'foot-walking'
                duration = ors_minutes(origin, destination, profile)
            elif mode == 'bus':
                profile = 'bus-transit'
                print(f"🚌 Explicitly calculating BUS time between {origin} and {destination}")
                duration = otp_fastest_minutes(origin, destination)
                
                if duration is None:
                    print(f"⚠️ Warning: No bus route found. Trying to find alternative modes.")
                    # If no bus route is available, try to find an alternative mode
                    other_modes = [('foot-walking', 'walking'), ('cycling-regular', 'cycling'), ('driving-car', 'driving')]
                    for test_mode, name in other_modes:
                        alt_duration = ors_minutes(origin, destination, test_mode)
                        if alt_duration:
                            print(f"⚠️ Using {name} as fallback since no bus route exists")
                            profile = test_mode
                            duration = alt_duration
                            break
                    
                    if duration is None:
                        print(f"❌ No route found for any mode")
                        return None
                
                # Still collect all modes for display, but use bus as the primary mode
                times = {}
                if duration:
                    times[profile] = duration
                
                # Optionally calculate other modes for comparison only
                other_modes = [('driving-car', 'driving'), ('cycling-regular', 'cycling'), ('foot-walking', 'walking')]
                for ors_mode, display_name in other_modes:
                    if ors_mode != profile:  # Skip if we already used this as fallback
                        other_duration = ors_minutes(origin, destination, ors_mode)
                        if other_duration:
                            times[ors_mode] = other_duration
                
                print(f"🚌 Bus travel time result: {duration} minutes via {profile} (all times: {times})")
                
                # Return the bus duration as the main duration, regardless of whether it's fastest
                return {
                    "duration": duration,
                    "mode": profile,
                    "all_times": times
                }
            else:
                profile = 'driving-car'  # default to driving
                duration = ors_minutes(origin, destination, profile)
                
            if duration:
                return {
                    "duration": duration,
                    "mode": profile,
                    "all_times": {profile: duration}
                }
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
    print(f"📝 Request headers: {dict(request.headers)}")
    print(f"📝 Request args: {request.args}")
    
    city = request.args.get('city', "Cardiff, UK")
    travel_preferences_str = request.args.get('travel_preferences')
    
    print(f"📍 Processing request for city: {city}")
    print(f"🔄 Raw travel preferences received: '{travel_preferences_str}'")
    
    try:
        # Parse travel preferences if they exist
        if travel_preferences_str and travel_preferences_str.lower() != 'null':
            travel_preferences = json.loads(travel_preferences_str)
            print(f"📦 Parsed travel preferences: {travel_preferences}")
            print(f"🚗 Travel mode selected: {travel_preferences.get('travelMode', 'auto')}")
            
            # Validate travel preferences format
            if 'locations' in travel_preferences:
                print(f"Found {len(travel_preferences['locations'])} travel locations")
                for loc in travel_preferences['locations']:
                    print(f"Location: {loc}")
        else:
            travel_preferences = None
            print("No travel preferences provided or 'null' received")
        
        print("🔍 Starting location analysis...")
        locations = analyze_location(city, travel_preferences)
        print(f"✅ Analysis complete. Found {len(locations)} locations")
        
        response_data = {
            "city": city,
            "locations": locations
        }
        
        print("📤 Sending response to client")
        return jsonify(response_data)
    except json.JSONDecodeError as e:
        print(f"❌ JSON Decode Error: {str(e)}")
        return jsonify({"error": "Invalid travel preferences format"}), 400
    except Exception as e:
        print(f"❌ Server Error: {str(e)}")
        import traceback
        print(f"Stack trace: {traceback.format_exc()}")
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

@app.route('/otp-status', methods=['GET'])
def get_otp_status():
    """Check if OTP is running and available and return transport mode comparison"""
    try:
        # Simple query to check if OTP is available
        query = {
            "query": "{ plan { modes } }"
        }
        response = requests.post(OTP_API_URL, json=query, timeout=5)
        data = response.json()
        
        # Generate sample travel time comparisons
        sample_points = [
            # Central Cardiff to Cardiff Bay
            ((51.481, -3.179), (51.465, -3.165), "City Center to Cardiff Bay"),
            # Cardiff University to Heath Hospital
            ((51.488, -3.179), (51.511, -3.175), "Cardiff University to Heath Hospital"),
            # Llandaff to Central Cardiff
            ((51.495, -3.215), (51.481, -3.179), "Llandaff to City Center")
        ]
        
        comparisons = []
        for origin, destination, label in sample_points:
            try:
                # Get all transport modes
                travel_times = calculate_travel_time(origin, destination, 'auto')
                if travel_times and 'all_times' in travel_times:
                    # Create a comparison object
                    comparison = {
                        "route": label,
                        "origin": {"lat": origin[0], "lon": origin[1]},
                        "destination": {"lat": destination[0], "lon": destination[1]},
                        "fastest_mode": travel_times["mode"],
                        "fastest_time": travel_times["duration"],
                        "times_by_mode": travel_times["all_times"]
                    }
                    comparisons.append(comparison)
            except Exception as route_e:
                print(f"Error calculating route for {label}: {route_e}")
        
        if "data" in data and "plan" in data["data"] and "modes" in data["data"]["plan"]:
            return jsonify({
                "status": "available",
                "modes": data["data"]["plan"]["modes"],
                "transport_comparisons": comparisons,
                "otp_url": OTP_API_URL,
                "note": "These sample routes show how different transport modes compare in the same journey. Mode with lowest time is preferred when 'auto' is selected."
            })
        else:
            return jsonify({
                "status": "unavailable", 
                "error": "Invalid response format",
                "transport_comparisons": comparisons
            }), 503
    except Exception as e:
        return jsonify({"status": "unavailable", "error": str(e)}), 503

@app.route('/query', methods=['POST'])
def otp_query():
    """Forward GraphQL queries to OTP"""
    try:
        data = request.json
        response = requests.post(OTP_API_URL, json=data, timeout=15)
        return response.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/test-otp', methods=['GET'])
def test_otp():
    """Test endpoint for OTP routing"""
    try:
        # Default coordinates for testing (central Cardiff locations)
        from_lat = request.args.get('from_lat', '51.4818')
        from_lon = request.args.get('from_lon', '-3.1790')
        to_lat = request.args.get('to_lat', '51.4613')
        to_lon = request.args.get('to_lon', '-3.1583')
        
        print(f"Testing OTP routing from ({from_lat},{from_lon}) to ({to_lat},{to_lon})")
        
        # Test direct OTP call
        duration = otp_fastest_minutes(
            (float(from_lat), float(from_lon)),
            (float(to_lat), float(to_lon))
        )
        
        # Test through calculate_travel_time
        travel_result = calculate_travel_time(
            (float(from_lat), float(from_lon)),
            (float(to_lat), float(to_lon)),
            mode='bus'
        )
        
        # Test auto mode
        auto_result = calculate_travel_time(
            (float(from_lat), float(from_lon)),
            (float(to_lat), float(to_lon)),
            mode='auto'
        )
        
        return jsonify({
            "direct_otp_call": {
                "duration_minutes": duration,
                "success": duration is not None
            },
            "bus_mode_call": travel_result,
            "auto_mode_call": auto_result,
            "from": f"{from_lat},{from_lon}",
            "to": f"{to_lat},{to_lon}"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/transport-comparison', methods=['GET'])
def transport_comparison():
    """Compare travel times between different transport modes for specific coordinates"""
    try:
        # Get coordinates from request
        from_lat = request.args.get('from_lat')
        from_lon = request.args.get('from_lon')
        to_lat = request.args.get('to_lat')
        to_lon = request.args.get('to_lon')
        
        # Check if all coordinates are provided
        if not (from_lat and from_lon and to_lat and to_lon):
            return jsonify({
                "error": "Missing coordinates. Required parameters: from_lat, from_lon, to_lat, to_lon"
            }), 400
            
        # Convert to float
        origin = (float(from_lat), float(from_lon))
        destination = (float(to_lat), float(to_lon))
        
        # Calculate travel times for each mode
        modes = ['auto', 'driving', 'cycling', 'walking', 'bus']
        results = {}
        
        for mode in modes:
            try:
                result = calculate_travel_time(origin, destination, mode)
                if result:
                    # Format the result
                    formatted_result = {
                        "duration_minutes": result["duration"],
                        "transport_mode": result["mode"]
                    }
                    
                    # Add all times if available (for auto mode)
                    if "all_times" in result:
                        formatted_result["alternative_modes"] = result["all_times"]
                        
                    results[mode] = formatted_result
                else:
                    results[mode] = {"error": "No route found"}
            except Exception as e:
                results[mode] = {"error": str(e)}
        
        # Get optimal mode
        optimal_mode = min(
            [m for m in results.keys() if isinstance(results[m], dict) and "duration_minutes" in results[m]],
            key=lambda m: results[m]["duration_minutes"],
            default=None
        )
        
        # Get postcodes if available
        from_postcode = None
        to_postcode = None
        try:
            # This is a placeholder - you'd need to implement a reverse geocoding function
            # from_postcode = get_postcode_from_coordinates(origin)
            # to_postcode = get_postcode_from_coordinates(destination)
            pass
        except Exception:
            pass
            
        return jsonify({
            "origin": {
                "lat": origin[0],
                "lon": origin[1],
                "postcode": from_postcode
            },
            "destination": {
                "lat": destination[0],
                "lon": destination[1],
                "postcode": to_postcode
            },
            "travel_modes": results,
            "optimal_mode": optimal_mode,
            "google_maps_link": f"https://www.google.com/maps/dir/{origin[0]},{origin[1]}/{destination[0]},{destination[1]}"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
