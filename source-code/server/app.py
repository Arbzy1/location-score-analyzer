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

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

print("Server: Starting up Flask application...")
ox.settings.use_cache = False
ox.settings.log_console = True

def analyze_location(city):
    print(f"Server: Analyzing {city}...")
    
    # 1. Retrieve City Boundary and Project
    city_gdf = ox.geocode_to_gdf(city)
    if city_gdf.empty:
        raise Exception(f"Could not retrieve boundary for {city}")

    city_polygon = city_gdf.unary_union
    city_gdf_proj = gpd.GeoDataFrame(geometry=[city_polygon], crs="EPSG:4326").to_crs(epsg=3857)
    city_polygon_proj = city_gdf_proj.geometry.iloc[0]

    # 2. Generate Random Points
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

    # 3. Retrieve Amenities
    schools = ox.features_from_place(city, {"amenity": "school"})
    hospitals = ox.features_from_place(city, {"amenity": "hospital"})
    try:
        supermarkets = ox.features_from_place(city, {"amenity": "supermarket"})
    except:
        try:
            supermarkets = ox.features_from_place(city, {"shop": ["supermarket", "convenience"]})
        except:
            supermarkets = gpd.GeoDataFrame()

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

    # 4. Scoring Functions
    def get_nearest_amenity(pt, gdf):
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

    thresholds = {
        "school": 1000,
        "hospital": 2000,
        "supermarket": 1000
    }
    
    weights = {
        "school": 0.4,
        "hospital": 0.5,
        "supermarket": 0.3
    }

    # 5. Process and Return Results
    locations = []
    for pt in candidate_points:
        location_data = {
            "lat": pt.y,
            "lon": pt.x,
            "category": "Recommended Location",
            "area_name": find_nearest_place(pt.y, pt.x),
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

    # Sort by score
    locations.sort(key=lambda x: x["score"], reverse=True)
    return locations[:10]  # Return top 10 locations

@app.route('/amenities', methods=['GET', 'OPTIONS'])
def get_amenities():
    if request.method == 'OPTIONS':
        return '', 204
        
    print("Server: Handling GET request")
    city = request.args.get('city', "Cardiff, UK")
    
    try:
        locations = analyze_location(city)
        response_data = {
            "city": city,
            "locations": locations
        }
        return jsonify(response_data)
    except Exception as e:
        print(f"Server Error: {str(e)}")
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
    print("Server: Starting Flask development server...")
    app.run(debug=True, port=5000)
