from flask import Flask, request, jsonify
from flask_cors import CORS
import osmnx as ox
from shapely.geometry import MultiPolygon, Polygon

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# 📌 Disable cache to force fresh OSM data
ox.settings.use_cache = False
ox.settings.log_console = True  # Show logs for debugging

# 🔍 Function to fetch amenities & handle multipolygons
def get_amenities(amenity, search_area, alt_tag=None):
    try:
        tags = {"amenity": amenity}
        if alt_tag:
            tags = {alt_tag: "hospital"}  # Alternative query

        gdf = ox.features_from_place(search_area, tags)

        if gdf.empty:
            print(f"❌ No {amenity} found in {search_area}. Trying wider search...")
            return None

        # 🔹 Ensure all geometries are points
        def extract_coordinates(geometry):
            if isinstance(geometry, (Polygon, MultiPolygon)):
                return geometry.centroid  # Convert polygons to a single point
            return geometry  # Keep normal points as is

        gdf["geometry"] = gdf["geometry"].apply(extract_coordinates)

        return gdf

    except Exception as e:
        print(f"⚠️ Error retrieving {amenity}: {e}")
        return None


@app.route('/api/amenities', methods=['GET'])
def fetch_amenities():
    # 🌍 Get city from query parameters (or default to Cardiff)
    city = request.args.get("city", "Cardiff, UK")

    # 🏙 Define different search areas
    suburb = city
    main_city = city  # Expanding search for hospitals

    # 🔍 Fetch different amenities
    schools = get_amenities("school", suburb)
    hospitals = get_amenities("hospital", main_city, alt_tag="healthcare")
    supermarkets = get_amenities("supermarket", suburb)
    if supermarkets is None or supermarkets.empty:
        supermarkets = get_amenities("supermarket", main_city, alt_tag="shop")  # Second try
    cafes = get_amenities("cafe", suburb)
    restaurants = get_amenities("restaurant", suburb)

    # 🏆 Compile locations
    locations = []
    for gdf, category in [(schools, "School"), (hospitals, "Hospital"), (supermarkets, "Supermarket"),
                          (cafes, "Cafe"), (restaurants, "Restaurant")]:
        if gdf is not None and not gdf.empty:
            for _, row in gdf.iterrows():
                locations.append({
                    "category": category,
                    "name": row.get("name", "Unknown"),
                    "lat": row.geometry.y,  # Extract centroid Y (Latitude)
                    "lon": row.geometry.x,  # Extract centroid X (Longitude)
                    "google_maps_link": f"https://www.google.com/maps?q={row.geometry.y},{row.geometry.x}",
                    "reason": {
                        "School": "Great for families with kids 🎒",
                        "Hospital": "Quick access to medical care 🏥",
                        "Supermarket": "Convenient for groceries 🛒",
                        "Cafe": "Perfect for remote work & coffee ☕",
                        "Restaurant": "Great for dining out 🍽️"
                    }.get(category, "Good location")
                })

    # 🚨 If no locations found, return an error
    if not locations:
        return jsonify({"error": f"No amenities found in {city}"}), 404

    # ✅ Return JSON response
    return jsonify({"city": city, "locations": locations})


# 🚀 Run Flask
if __name__ == "__main__":
    app.run(debug=True, port=5000)
