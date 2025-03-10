from flask import Flask, request, jsonify
from flask_cors import CORS
import osmnx as ox
import geopandas as gpd
import random
from shapely.geometry import Point, Polygon
from shapely.ops import transform
import pyproj
from functools import wraps
import math
import requests

app = Flask(__name__)

# Configure CORS properly
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],  # Add your frontend URL
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Origin"],
        "supports_credentials": False
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
        print("📍 Retrieving city boundary...")
        city_gdf = ox.geocode_to_gdf(city)
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

        num_candidates = 50
        candidate_points_proj = generate_random_points_within(city_polygon_proj, num_candidates)
        project_to_wgs84 = pyproj.Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True).transform
        candidate_points = [transform(project_to_wgs84, pt) for pt in candidate_points_proj]
        print(f"✅ Generated {len(candidate_points)} candidate points")

        # 3. Retrieve Amenities
        print("🏫 Retrieving amenities...")
        schools = ox.features_from_place(city, {"amenity": "school"})
        print("✅ Schools retrieved")
        hospitals = ox.features_from_place(city, {"amenity": "hospital"})
        print("✅ Hospitals retrieved")
        try:
            supermarkets = ox.features_from_place(city, {"amenity": "supermarket"})
            print("✅ Supermarkets retrieved (amenity)")
        except:
            try:
                supermarkets = ox.features_from_place(city, {"shop": ["supermarket", "convenience"]})
                print("✅ Supermarkets retrieved (shop)")
            except:
                supermarkets = gpd.GeoDataFrame()
                print("⚠️ No supermarkets found")

        print("📊 Processing amenity data...")
        # Get area names for the city once instead of per point
        print("🏘️ Retrieving area names...")
        overpass_url = "http://overpass-api.de/api/interpreter"
        area_query = f"""
        [out:json][timeout:30];
        area[name="{city}"]->.searchArea;
        (
          node["place"~"^(village|suburb|town|city|hamlet)$"](area.searchArea);
          way["place"~"^(village|suburb|town|city|hamlet)$"](area.searchArea);
          relation["place"~"^(village|suburb|town|city|hamlet)$"](area.searchArea);
        );
        out center;
        """
        try:
            area_response = requests.get(overpass_url, params={'data': area_query}, timeout=30)
            print(f"Area response status: {area_response.status_code}")
            area_data = area_response.json()
            areas = []
            for elem in area_data.get("elements", []):
                if "tags" in elem and "name" in elem["tags"]:
                    if "lat" in elem and "lon" in elem:
                        areas.append({
                            "name": elem["tags"]["name"],
                            "lat": elem["lat"],
                            "lon": elem["lon"]
                        })
                    elif "center" in elem:
                        areas.append({
                            "name": elem["tags"]["name"],
                            "lat": elem["center"]["lat"],
                            "lon": elem["center"]["lon"]
                        })
            print(f"Found {len(areas)} areas")
        except Exception as e:
            print(f"⚠️ Error retrieving area names: {e}")
            print("Falling back to city name for areas")
            areas = [{
                "name": city,
                "lat": city_gdf.geometry.centroid.y.iloc[0],
                "lon": city_gdf.geometry.centroid.x.iloc[0]
            }]

        def find_nearest_area(lat, lon, areas):
            if not areas:
                return "Unknown Area"
            min_dist = None
            nearest_name = None
            for area in areas:
                d = haversine((lat, lon), (area["lat"], area["lon"]))
                if min_dist is None or d < min_dist:
                    min_dist = d
                    nearest_name = area["name"]
            return nearest_name if nearest_name else "Unknown Area"

        # Ensure correct CRS and use centroids
        def use_centroid(gdf):
            if gdf is not None and not gdf.empty:
                if gdf.crs != "EPSG:4326":
                    gdf = gdf.to_crs("EPSG:4326")
                gdf["geometry"] = gdf["geometry"].apply(
                    lambda geom: geom.centroid if geom.geom_type in ["Polygon", "MultiPolygon"] else geom
                )
            return gdf

        amenity_data = {
            "school": use_centroid(schools),
            "hospital": use_centroid(hospitals),
            "supermarket": use_centroid(supermarkets)
        }

        # Process locations with optimized area lookup
        locations = []
        for pt in candidate_points:
            location_data = {
                "lat": pt.y,
                "lon": pt.x,
                "category": "Recommended Location",
                "area_name": find_nearest_area(pt.y, pt.x, areas),
                "amenities": {}
            }
            
            total_score = 0
            for a_type, gdf in amenity_data.items():
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
            location_data["reason"] = f"Near: {', '.join(f'{k}: {v['name']} ({v['distance']}m)' for k, v in location_data['amenities'].items())}"
            location_data["google_maps_link"] = f"https://www.google.com/maps?q={pt.y},{pt.x}"
            
            locations.append(location_data)

        # Sort by score and add debug info
        locations.sort(key=lambda x: x["score"], reverse=True)
        top_locations = locations[:10]
        
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
        print("⏳ Analyzing location...")
        locations = analyze_location(city)
        print(f"✅ Analysis complete. Found {len(locations)} locations")
        
        response_data = {
            "city": city,
            "locations": locations
        }
        print("📤 Sending response to client")
        print(f"📊 Response summary: {len(locations)} locations for {city}\n")
        
        response = jsonify(response_data)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response
    except Exception as e:
        print(f"❌ Server Error: {str(e)}")
        error_response = jsonify({"error": str(e)})
        error_response.headers.add('Access-Control-Allow-Origin', '*')
        print("🔴 Error response sent to client\n")
        return error_response, 500

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
    print("Server: Starting Flask development server...")
    app.run(debug=True, port=5000)
