from flask import Flask, request, jsonify
from flask_cors import CORS
import osmnx as ox
from shapely.geometry import MultiPolygon, Polygon
from functools import wraps
from flask import request, abort

app = Flask(__name__)

# Configure CORS properly
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173"],  # Your frontend URL
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

print("Server: Starting up Flask application...")

# 📌 Disable cache to force fresh OSM data
ox.settings.use_cache = False
ox.settings.log_console = True  # Show logs for debugging

# 🔍 Function to fetch amenities & handle multipolygons
def fetch_amenity(amenity, search_area, alt_tag=None):
    print(f"Server: Fetching {amenity} in {search_area}")
    try:
        tags = {"amenity": amenity}
        if alt_tag:
            tags = {alt_tag: "hospital"}
            print(f"Server: Using alternative tag: {tags}")

        print(f"Server: Querying OSM with tags: {tags}")
        gdf = ox.features_from_place(search_area, tags)
        print(f"Server: Retrieved {len(gdf)} features")

        if gdf.empty:
            print(f"Server: No {amenity} found in {search_area}")
            return None

        # 🔹 Ensure all geometries are points
        def extract_coordinates(geometry):
            if isinstance(geometry, (Polygon, MultiPolygon)):
                print(f"Server: Converting polygon/multipolygon to centroid")
                return geometry.centroid  # Convert polygons to a single point
            return geometry  # Keep normal points as is

        gdf["geometry"] = gdf["geometry"].apply(extract_coordinates)
        print(f"Server: Processed geometries successfully")

        return gdf

    except Exception as e:
        print(f"Server: Error in fetch_amenity: {str(e)}")
        return None


@app.route('/amenities', methods=['GET', 'OPTIONS'])
def get_amenities():
    if request.method == 'OPTIONS':
        print("Server: Handling OPTIONS preflight request")
        return '', 204
        
    print("Server: Handling GET request")
    city = request.args.get('city')
    city = city or "Cardiff, UK"

    # Initialize locations list at the start
    locations = []

    # 🏙 Define different search areas
    suburb = city
    main_city = city

    # 🔍 Fetch different amenities
    schools = fetch_amenity("school", suburb)
    hospitals = fetch_amenity("hospital", main_city, alt_tag="healthcare")
    supermarkets = fetch_amenity("supermarket", suburb)
    if supermarkets is None or supermarkets.empty:
        supermarkets = fetch_amenity("supermarket", main_city, alt_tag="shop")
    cafes = fetch_amenity("cafe", suburb)
    restaurants = fetch_amenity("restaurant", suburb)

    # Process each amenity type
    for gdf, category in [(schools, "School"), (hospitals, "Hospital"), 
                         (supermarkets, "Supermarket"), (cafes, "Cafe"), 
                         (restaurants, "Restaurant")]:
        if gdf is not None and not gdf.empty:
            for _, row in gdf.iterrows():
                locations.append({
                    "category": category,
                    "name": str(row.get("name", "Unknown")),
                    "lat": float(row.geometry.y),
                    "lon": float(row.geometry.x),
                    "google_maps_link": f"https://www.google.com/maps?q={row.geometry.y},{row.geometry.x}",
                    "reason": {
                        "School": "Great for families with kids",
                        "Hospital": "Quick access to medical care",
                        "Supermarket": "Convenient for groceries",
                        "Cafe": "Perfect for remote work & coffee",
                        "Restaurant": "Great for dining out"
                    }.get(category, "Good location")
                })

    # Return consistent response structure
    response_data = {
        "city": city,
        "locations": locations
    }
    
    print(f"Server: Returning {len(locations)} locations")
    return jsonify(response_data)


def add_cors_headers(response):
    print("Server: Adding CORS headers to response")
    print(f"Server: Request method: {request.method}")
    print(f"Server: Request headers: {dict(request.headers)}")
    return response

app.after_request(add_cors_headers)

# 🚀 Run Flask
if __name__ == "__main__":
    print("Server: Starting Flask development server...")
    app.run(debug=True, port=5000)
