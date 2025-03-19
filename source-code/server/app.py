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

# Cache amenity lookups
@lru_cache(maxsize=32)
def get_amenities(city, amenity_type):
    print(f"🏫 Retrieving {amenity_type}...")
    try:
        return ox.features_from_place(city, amenity_type)
    except Exception as e:
        print(f"⚠️ Error retrieving {amenity_type}: {e}")
        return gpd.GeoDataFrame()

def analyze_location(city):
    print(f"🔍 Starting analysis for {city}...")
    
    # Define scoring parameters
    thresholds = {
        "school": 1000,      # 1km
        "hospital": 2000,    # 2km
        "supermarket": 1000  # 1km
    }
    
    weights = {
        "school": 0.4,
        "hospital": 0.5,
        "supermarket": 0.3
    }
    
    try:
        # Use cached city boundary
        city_gdf = get_city_boundary(city)
        if city_gdf.empty:
            print(f"❌ Could not retrieve boundary for {city}")
            return []

        city_polygon = city_gdf.unary_union
        city_gdf_proj = gpd.GeoDataFrame(geometry=[city_polygon], crs="EPSG:4326").to_crs(epsg=3857)
        city_polygon_proj = city_gdf_proj.geometry.iloc[0]
        print("✅ City boundary retrieved successfully")

        # 2. Generate Random Points
        print("🎲 Generating random points...")
        def generate_random_points_within(poly, num_points):
            minx, miny, maxx, maxy = poly.bounds
            points = []
            attempts = 0
            while len(points) < num_points and attempts < num_points * 20:
                random_point = Point(random.uniform(minx, maxx), random.uniform(miny, maxy))
                if poly.contains(random_point):
                    points.append(random_point)
                attempts += 1
            return points

        num_candidates = 20  # Reduced from 50
        candidate_points_proj = generate_random_points_within(city_polygon_proj, num_candidates)
        project_to_wgs84 = pyproj.Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True).transform
        candidate_points = [transform(project_to_wgs84, pt) for pt in candidate_points_proj]
        print(f"✅ Generated {len(candidate_points)} candidate points")

        # 3. Retrieve Amenities
        print("🏫 Retrieving amenities...")
        # Get amenities with timeout protection
        amenities_data = {}
        for amenity_type in [
            {"amenity": "school"},
            {"amenity": "hospital"},
            {"amenity": "supermarket"}
        ]:
            try:
                gdf = get_amenities(city, amenity_type)
                if not gdf.empty:
                    amenities_data[str(amenity_type)] = use_centroid(gdf)
            except Exception as e:
                print(f"⚠️ Error processing {amenity_type}: {e}")
                continue

        print("📊 Processing amenity data...")
        # Get area names for the city once instead of per point
        print("🏘️ Retrieving area names...")
        overpass_url = "http://overpass-api.de/api/interpreter"
        # Get the city's bounding box
        bbox = city_gdf.total_bounds  # minx, miny, maxx, maxy
        # Create a query using the bounding box instead of area name
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
            area_response = requests.get(overpass_url, params={'data': area_query}, timeout=30)
            print(f"Area response status: {area_response.status_code}")
            area_data = area_response.json()
            areas = []
            for elem in area_data.get("elements", []):
                if "tags" in elem and "name" in elem["tags"]:
                    area_name = elem["tags"]["name"]
                    if "lat" in elem and "lon" in elem:
                        areas.append({
                            "name": area_name,
                            "lat": elem["lat"],
                            "lon": elem["lon"],
                            "type": elem["tags"].get("place", "unknown")
                        })
                    elif "center" in elem:
                        areas.append({
                            "name": area_name,
                            "lat": elem["center"]["lat"],
                            "lon": elem["center"]["lon"],
                            "type": elem["tags"].get("place", "unknown")
                        })
            print(f"Found {len(areas)} areas: {[area['name'] for area in areas]}")
            
            if not areas:
                print("No areas found, falling back to geocoding")
                # Fallback: Use the city name itself
                areas = [{
                    "name": city,
                    "lat": city_gdf.geometry.centroid.y.iloc[0],
                    "lon": city_gdf.geometry.centroid.x.iloc[0],
                    "type": "city"
                }]
        except Exception as e:
            print(f"⚠️ Error retrieving area names: {e}")
            print("Falling back to city name for areas")
            areas = [{
                "name": city,
                "lat": city_gdf.geometry.centroid.y.iloc[0],
                "lon": city_gdf.geometry.centroid.x.iloc[0],
                "type": "city"
            }]

        def find_nearest_area(lat, lon, areas):
            if not areas:
                return "Unknown Area"
            min_dist = None
            nearest_area = None
            for area in areas:
                d = haversine((lat, lon), (area["lat"], area["lon"]))
                if min_dist is None or d < min_dist:
                    min_dist = d
                    nearest_area = area
            
            if nearest_area:
                # Format the area name based on its type
                area_type = nearest_area.get("type", "area")
                if area_type in ["suburb", "neighbourhood", "quarter"]:
                    return f"{nearest_area['name']}"
                else:
                    return f"{nearest_area['name']}"
            return "Unknown Area"

        # Ensure correct CRS and use centroids
        def use_centroid(gdf):
            if gdf is not None and not gdf.empty:
                if gdf.crs != "EPSG:4326":
                    gdf = gdf.to_crs("EPSG:4326")
                gdf["geometry"] = gdf["geometry"].apply(
                    lambda geom: geom.centroid if geom.geom_type in ["Polygon", "MultiPolygon"] else geom
                )
            return gdf

        # Process in smaller batches
        batch_size = 5
        locations = []
        for i in range(0, len(candidate_points), batch_size):
            batch = candidate_points[i:i + batch_size]
            for pt in batch:
                location_data = {
                    "lat": pt.y,
                    "lon": pt.x,
                    "category": "Recommended Location",
                    "area_name": find_nearest_area(pt.y, pt.x, areas),
                    "amenities": {}
                }
                
                total_score = 0
                for a_type, gdf in amenities_data.items():
                    if gdf is not None and not gdf.empty:
                        distance, nearest = get_nearest_amenity(pt, gdf)
                        if distance is not None:
                            score = weights[a_type] * (thresholds[a_type] - distance) / thresholds[a_type] if distance < thresholds[a_type] else 0
                            total_score += score
                            
                            location_data["amenities"][a_type] = {
                                "name": nearest.get("name", "Unnamed"),
                                "distance": int(distance),
                                "lat": nearest.geometry.y,
                                "lon": nearest.geometry.x
                            }

                location_data["score"] = round(total_score * 100, 1)
                location_data["name"] = f"Location Score: {location_data['score']}/100"
                location_data["reason"] = (
                    f"Near: " + 
                    ', '.join(f"{k}: {v['name']} ({v['distance']}m)" for k, v in location_data['amenities'].items())
                )
                location_data["google_maps_link"] = f"https://www.google.com/maps?q={pt.y},{pt.x}"
                
                locations.append(location_data)
            # Add a small delay between batches to prevent overload
            time.sleep(0.1)

        # Sort by score and add debug info
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
        
    start_time = time.time()
    timeout = 25  # Set timeout to 25 seconds to prevent worker timeout

    print("\n🚀 Server: Starting new request processing...")
    city = request.args.get('city', "Cardiff, UK")
    print(f"📍 Processing request for city: {city}")
    
    try:
        locations = analyze_location(city)
        
        # Check if we're approaching timeout
        if time.time() - start_time > timeout:
            raise TimeoutError("Processing took too long")

        response_data = {
            "city": city,
            "locations": locations[:5]  # Limit to top 5 locations
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
