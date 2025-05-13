"""
Utility functions for PropertyFinder server application tests.
"""
import random
import math
from unittest.mock import MagicMock

def generate_random_points(center_lat, center_lon, count=10, radius_km=1.0):
    """Generate random geographical points around a center point."""
    points = []
    for _ in range(count):
        # Convert radius from km to degrees (rough approximation)
        radius_lat = radius_km / 111.0  # 1 degree lat is approximately 111 km
        radius_lon = radius_km / (111.0 * math.cos(math.radians(center_lat)))
        
        # Generate random offsets
        lat_offset = random.uniform(-radius_lat, radius_lat)
        lon_offset = random.uniform(-radius_lon, radius_lon)
        
        # Add offset to center coordinates
        lat = center_lat + lat_offset
        lon = center_lon + lon_offset
        
        points.append((lat, lon))
    
    return points

def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great-circle distance between two points
    on the Earth's surface given their latitude and longitude.
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of Earth in kilometers
    
    return c * r

def get_school_type(name):
    """Identify school type from its name."""
    name_lower = name.lower()
    if any(term in name_lower for term in ['primary', 'elementary', 'infant', 'junior']):
        return 'primary'
    elif any(term in name_lower for term in ['secondary', 'high', 'college', 'academy']):
        return 'secondary'
    else:
        return 'unknown'

def create_mock_response(status_code=200, json_data=None, raise_error=False):
    """Create a mock response object for testing."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = json_data if json_data is not None else {}
    
    if raise_error:
        mock_resp.raise_for_status.side_effect = Exception("HTTP Error")
    
    return mock_resp

def normalize_scores(scores):
    """Normalize a list of scores to a 0-100 scale."""
    if not scores:
        return []
    
    min_score = min(scores)
    max_score = max(scores)
    
    # Avoid division by zero
    if max_score == min_score:
        return [50 for _ in scores]
    
    return [((score - min_score) / (max_score - min_score)) * 100 for score in scores] 