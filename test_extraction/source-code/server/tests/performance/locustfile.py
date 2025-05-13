import pytest
from unittest.mock import MagicMock, patch
import requests
import json


from locust import HttpUser, task, between

class PropertyFinderUser(HttpUser):
    wait_time = between(1, 5)
    
    @task(3)
    def search_by_postcode(self):
        # Test performance of the postcode search endpoint
        self.client.get("/api/search?postcode=CF10%203NB")
    
    @task(2)
    def get_amenities(self):
        # Test performance of the amenities endpoint
        self.client.get("/api/amenities?city=Cardiff,%20UK")
        
    @task(1)
    def transport_comparison(self):
        # Test performance of the transport comparison endpoint
        self.client.get("/api/transport-comparison?from_lat=51.481&from_lon=-3.179&to_lat=51.465&to_lon=-3.165")
        
    @task(1)
    def get_bus_routes(self):
        # Test performance of the bus routes endpoint
        self.client.get("/api/bus-routes")
