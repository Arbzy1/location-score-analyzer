from flask import Flask, request, jsonify
from flask_cors import CORS
import osmnx as ox
import geopandas as gpd
import random
from shapely.geometry import Point, Polygon
from shapely.ops import transform
import pyproj
from functools import wraps, lru_cache
import math
import requests
import os
import time

app = Flask(__name__)

# Update CORS configuration to allow your Render domain
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:5173",  # Local development
            "http://127.0.0.1:5173",  # Local development alternative
            "https://tranquility.onrender.com",  # Your Render frontend domain
            "https://final-project-university-important-omg.onrender.com"  # Add your actual Render frontend domain
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

print("Server: Starting up Flask application...")
ox.settings.use_cache = False
ox.settings.log_console = True

def get_nearest_amenity(pt, gdf):
    """Find the nearest amenity and its distance from a point."""
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

# Cache the city boundary lookup to avoid repeated API calls
@lru_cache(maxsize=32)
def get_city_boundary(city):
    print(f"📍 Retrieving city boundary for {city}...")
    return ox.geocode_to_gdf(city)

def get_amenities_for_city(city, amenity_type):
    """Fixed function to get amenities with proper parameters"""
    print(f"🏫 Retrieving {amenity_type}...")
    try:
        return ox.features_from_place(city, amenity_type)
    except Exception as e:
        print(f"⚠️ Error retrieving {amenity_type}: {e}")
        return gpd.GeoDataFrame()

def analyze_location(city):
    print(f"🔍 Starting analysis for {city}...")
    
    try:
        # Get city boundary
        city_gdf = get_city_boundary(city)
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
        schools = get_amenities_for_city(city, {"amenity": "school"})
        print("✅ Schools retrieved")
        hospitals = get_amenities_for_city(city, {"amenity": "hospital"})
        print("✅ Hospitals retrieved")
        supermarkets = get_amenities_for_city(city, {"shop": "supermarket"})
        print("✅ Supermarkets retrieved")

        # Process locations
        print("📊 Processing amenity data...")
        locations = []
        for pt in candidate_points:
            location_data = process_location(pt, schools, hospitals, supermarkets, city)
            if location_data:
                locations.append(location_data)

        # Sort and return top locations
        locations.sort(key=lambda x: x["score"], reverse=True)
        return locations[:5]  # Return top 5 locations

    except Exception as e:
        print(f"❌ Error in analyze_location: {str(e)}\n")
        return []

def process_location(point, schools, hospitals, supermarkets, city):
    """Process a single location point"""
    location_data = {
        "lat": point.y,
        "lon": point.x,
        "category": "Recommended Location",
        "amenities": {},
        "score": 0
    }

    # Calculate scores for each amenity type
    amenities = {
        "school": (schools, 1000, 0.4),
        "hospital": (hospitals, 2000, 0.5),
        "supermarket": (supermarkets, 1000, 0.3)
    }

    total_score = 0
    for a_type, (gdf, threshold, weight) in amenities.items():
        if not gdf.empty:
            distance, nearest = get_nearest_amenity(point, gdf)
            if distance is not None:
                score = weight * (threshold - distance) / threshold if distance < threshold else 0
                total_score += score
                
                location_data["amenities"][a_type] = {
                    "name": nearest.get("name", "Unnamed"),
                    "distance": int(distance)
                }

    location_data["score"] = round(total_score * 100, 1)
    location_data["area_name"] = find_nearest_area(point.y, point.x)
    location_data["google_maps_link"] = f"https://www.google.com/maps?q={point.y},{point.x}"

    return location_data

@app.route('/amenities', methods=['GET', 'OPTIONS'])
def get_amenities_route():
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

def haversine(coord1, coord2):
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))

def find_nearest_place(lat, lon, radius=3000):
    overpass_url = "http://overpass-api.de/api/interpreter"
    query = f"""
    [out:json][timeout:10];
    (
      node["place"~"^(village|suburb|town|city|hamlet)$"](around:{radius},{lat},{lon});
      way["place"~"^(village|suburb|town|city|hamlet)$"](around:{radius},{lat},{lon});
      relation["place"~"^(village|suburb|town|city|hamlet)$"](around:{radius},{lat},{lon});
    );
    out center;
    """
    try:
        response = requests.get(overpass_url, params={'data': query}, timeout=20)
        if response.status_code == 200:
            data = response.json()
            elements = data.get("elements", [])
            if not elements:
                return "Unknown Area"
            min_dist = None
            nearest_name = None
            for elem in elements:
                if "lat" in elem and "lon" in elem:
                    item_lat = elem["lat"]
                    item_lon = elem["lon"]
                elif "center" in elem:
                    item_lat = elem["center"]["lat"]
                    item_lon = elem["center"]["lon"]
                else:
                    continue
                d = haversine((lat, lon), (item_lat, item_lon))
                if min_dist is None or d < min_dist:
                    min_dist = d
                    nearest_name = elem.get("tags", {}).get("name", "Unknown Area")
            return nearest_name if nearest_name else "Unknown Area"
    except Exception as e:
        print(f"Error finding nearest place: {e}")
        return "Unknown Area"

def generate_random_points(polygon, num_points):
    """Generate random points within a polygon"""
    points = []
    minx, miny, maxx, maxy = polygon.bounds
    attempts = 0
    max_attempts = num_points * 20  # Limit the number of attempts

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

if __name__ == "__main__":
    # Use Render's default port (10000) if PORT isn't set
    port = int(os.environ.get('PORT', 10000))
    
    print(f"Server: Starting on port {port}")
    
    # Explicitly bind to 0.0.0.0 as required by Render
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True
    )
