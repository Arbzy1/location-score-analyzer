import pandas as pd
from pathlib import Path
import json
import math

class GTFSService:
    def __init__(self):
        self.gtfs_path = Path(__file__).parent / 'GTFS'
        self.routes_df = None
        self.stops_df = None
        self.stop_times_df = None
        self.trips_df = None
        self.shapes_df = None
        self.load_data()

    def load_data(self):
        """Load all GTFS data into memory"""
        print("Loading GTFS data...")
        self.routes_df = pd.read_csv(self.gtfs_path / 'routes.txt')
        self.stops_df = pd.read_csv(self.gtfs_path / 'stops.txt')
        self.stop_times_df = pd.read_csv(self.gtfs_path / 'stop_times.txt')
        self.trips_df = pd.read_csv(self.gtfs_path / 'trips.txt')
        self.shapes_df = pd.read_csv(self.gtfs_path / 'shapes.txt')
        print("GTFS data loaded successfully")

    def haversine_distance(self, lat1, lon1, lat2, lon2):
        """Calculate the great circle distance between two points"""
        R = 6371000  # Earth's radius in meters

        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)

        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
        return 2*R*math.asin(math.sqrt(a))

    def get_nearest_bus_stop(self, lat, lon, max_distance=1000):
        """Find the nearest bus stop within max_distance meters"""
        min_distance = float('inf')
        nearest_stop = None
        
        for _, stop in self.stops_df.iterrows():
            distance = self.haversine_distance(lat, lon, stop['stop_lat'], stop['stop_lon'])
            if distance < min_distance and distance <= max_distance:
                min_distance = distance
                nearest_stop = stop
        
        if nearest_stop is not None:
            return {
                'stop_id': nearest_stop['stop_id'],
                'name': nearest_stop['stop_name'],
                'distance': min_distance,
                'lat': nearest_stop['stop_lat'],
                'lon': nearest_stop['stop_lon']
            }
        return None

    def get_route_accessibility(self, lat, lon, max_distance=500):
        """Get all bus routes accessible within max_distance meters"""
        nearest_stop = self.get_nearest_bus_stop(lat, lon, max_distance)
        if not nearest_stop:
            return []
        
        # Get all trips that stop at this stop
        stop_trips = self.stop_times_df[self.stop_times_df['stop_id'] == nearest_stop['stop_id']]
        route_ids = self.trips_df[self.trips_df['trip_id'].isin(stop_trips['trip_id'])]['route_id'].unique()
        
        accessible_routes = []
        for route_id in route_ids:
            route = self.routes_df[self.routes_df['route_id'] == route_id].iloc[0]
            # Use route_short_name as name if route_long_name is not available
            route_name = route['route_long_name'] if pd.notna(route['route_long_name']) else f"Route {route['route_short_name']}"
            accessible_routes.append({
                'route_id': route_id,
                'name': route_name,
                'ref': route['route_short_name'],
                'distance': nearest_stop['distance']
            })
        
        return accessible_routes

    def calculate_transit_score(self, lat, lon, max_distance=500):
        """Calculate a transit accessibility score (0-100)"""
        accessible_routes = self.get_route_accessibility(lat, lon, max_distance)
        if not accessible_routes:
            return 0
        
        # Score based on number of routes and distance
        num_routes = len(accessible_routes)
        min_distance = min(route['distance'] for route in accessible_routes)
        
        # Weight the score (70% for number of routes, 30% for distance)
        route_score = min(num_routes * 10, 70)  # Up to 70 points for number of routes
        distance_score = max(30 * (1 - min_distance/max_distance), 0)  # Up to 30 points for distance
        
        return round(route_score + distance_score, 1)

    def get_routes_geojson(self):
        """Convert routes and stops to GeoJSON format"""
        # Create stops GeoJSON
        stops_features = []
        for _, stop in self.stops_df.iterrows():
            try:
                feature = {
                    "type": "Feature",
                    "id": str(stop['stop_id']),  # Ensure ID is a string
                    "properties": {
                        "id": str(stop['stop_id']),
                        "name": str(stop['stop_name']) if pd.notna(stop['stop_name']) else "Unknown Stop",
                        "type": "bus_stop"
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(stop['stop_lon']), float(stop['stop_lat'])]
                    }
                }
                stops_features.append(feature)
            except (ValueError, TypeError) as e:
                print(f"Error processing stop {stop['stop_id']}: {e}")
                continue

        # Create routes GeoJSON
        routes_features = []
        for _, route in self.routes_df.iterrows():
            try:
                # Get all trips for this route
                route_trips = self.trips_df[self.trips_df['route_id'] == route['route_id']]
                
                if route_trips.empty:
                    continue
                    
                # Get one representative trip for this route
                sample_trip = route_trips.iloc[0]
                
                # Get the shape for this trip
                route_shapes = self.shapes_df[self.shapes_df['shape_id'] == sample_trip['shape_id']]
                
                if route_shapes.empty:
                    continue
                    
                # Sort shapes by sequence and ensure valid coordinates
                route_shapes = route_shapes.sort_values('shape_pt_sequence')
                coordinates = []
                for _, shape in route_shapes.iterrows():
                    try:
                        lon = float(shape['shape_pt_lon'])
                        lat = float(shape['shape_pt_lat'])
                        if -180 <= lon <= 180 and -90 <= lat <= 90:  # Validate coordinates
                            coordinates.append([lon, lat])
                    except (ValueError, TypeError):
                        continue

                if not coordinates:  # Skip if no valid coordinates
                    continue

                # Handle route names and references
                route_ref = str(route['route_short_name']) if pd.notna(route['route_short_name']) else ""
                route_name = str(route['route_long_name']) if pd.notna(route['route_long_name']) else f"Route {route_ref}"
                
                if not route_ref and not route_name:  # Skip if no valid identifiers
                    continue

                feature = {
                    "type": "Feature",
                    "id": str(route['route_id']),
                    "properties": {
                        "id": str(route['route_id']),
                        "name": route_name,
                        "ref": route_ref,
                        "type": "bus_route",
                        "operator": "Cardiff Bus"
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coordinates
                    }
                }
                routes_features.append(feature)
            except Exception as e:
                print(f"Error processing route {route['route_id']}: {e}")
                continue

        return {
            "routes": {
                "type": "FeatureCollection",
                "features": routes_features
            },
            "stops": {
                "type": "FeatureCollection",
                "features": stops_features
            }
        }

    def get_route_details(self, route_id):
        """Get detailed information about a specific route"""
        route = self.routes_df[self.routes_df['route_id'] == route_id].iloc[0]
        route_trips = self.trips_df[self.trips_df['route_id'] == route_id]
        
        # Get all stops for this route
        route_stops = self.stop_times_df[self.stop_times_df['trip_id'].isin(route_trips['trip_id'])]
        unique_stops = route_stops.merge(self.stops_df, on='stop_id')[['stop_id', 'stop_name', 'stop_lat', 'stop_lon']].drop_duplicates()
        
        return {
            "route_id": route_id,
            "name": route['route_long_name'],
            "ref": route['route_short_name'],
            "stops": unique_stops.to_dict('records')
        } 