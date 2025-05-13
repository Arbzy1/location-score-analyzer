# OpenTripPlanner integration for PropertyFinder
import requests

def run_otp_query(query):
    """Run a GraphQL query against OTP"""
    return {"data": {"plan": {"itineraries": []}}}

def otp_fastest_minutes(origin, destination, dt_iso="2025-05-01T08:00:00+01:00"):
    """Return best door-to-door duration (min) using TRANSIT+WALK or None."""
    lat1, lon1 = origin
    lat2, lon2 = destination
    
    # This would make an actual API call in the real implementation
    # For now, return a dummy value
    return 30
