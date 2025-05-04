import requests
import sys

def check_otp_server():
    try:
        # Try to connect to the OTP server
        response = requests.get("http://localhost:8080/otp", timeout=5)
        if response.status_code == 200:
            print("OTP server is running!")
            return True
        else:
            print(f"OTP server returned status code: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the OTP server at http://localhost:8080")
        print("Please make sure the OTP server is running.")
        return False
    except Exception as e:
        print(f"Error checking OTP server: {e}")
        return False

def run_otp_query(query_string, variables=None):
    """
    Run a GraphQL query against the OTP server.
    
    Args:
        query_string (str): The GraphQL query string
        variables (dict, optional): Variables to include with the query
        
    Returns:
        dict: The response data or None if there was an error
    """
    try:
        # GraphQL endpoint
        url = "http://localhost:8080/otp/routers/default/index/graphql"
        
        # Prepare the request payload
        payload = {
            "query": query_string
        }
        
        if variables:
            payload["variables"] = variables
            
        # Make the request
        response = requests.post(url, json=payload, timeout=15)
        
        # Check if the request was successful
        if response.status_code != 200:
            print(f"Error: OTP GraphQL server returned status code {response.status_code}")
            print(f"Response: {response.text}")
            return None
        
        # Parse the JSON response
        data = response.json()
        
        # Check for GraphQL errors
        if "errors" in data:
            print("GraphQL errors:", data["errors"])
            return None
            
        return data
    except Exception as e:
        print(f"Error making GraphQL request: {e}")
        return None

def list_available_routers():
    try:
        response = requests.get("http://localhost:8080/otp/routers", timeout=5)
        if response.status_code == 200:
            try:
                routers = response.json()
                print("Available routers:")
                for router in routers:
                    print(f"  - {router}")
                return routers
            except requests.exceptions.JSONDecodeError:
                print("Error: Could not parse JSON response from OTP server")
                print(f"Response: {response.text}")
                return []
        else:
            print(f"Error: OTP server returned status code {response.status_code}")
            print(f"Response: {response.text}")
            return []
    except Exception as e:
        print(f"Error listing routers: {e}")
        return []

def get_route(from_place, to_place, router="default", mode="TRANSIT,WALK", max_walk_distance=1000, num_itineraries=3):
    try:
        res = requests.get(f"http://localhost:8080/otp/routers/{router}/plan", params={
            "fromPlace": from_place,
            "toPlace": to_place,
            "mode": mode,
            "maxWalkDistance": max_walk_distance,
            "numItineraries": num_itineraries
        }, timeout=10)
        
        # Check if the request was successful
        if res.status_code != 200:
            print(f"Error: OTP server returned status code {res.status_code}")
            print(f"Response: {res.text}")
            return None
            
        # Try to parse the JSON response
        try:
            data = res.json()
            return data
        except requests.exceptions.JSONDecodeError:
            print("Error: Could not parse JSON response from OTP server")
            print(f"Response: {res.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Error making request to OTP server: {e}")
        return None

def main():
    # First check if the OTP server is running
    if not check_otp_server():
        print("Please start the OTP server and try again.")
        return
    
    # List available routers
    routers = list_available_routers()
    if not routers:
        print("No routers available. Please check your OTP server configuration.")
        return
    
    # Use the first available router if "default" is not available
    router = "default" if "default" in routers else routers[0]
    print(f"Using router: {router}")
    
    # Example coordinates (Cardiff)
    from_place = "51.4816,-3.1791"
    to_place = "51.4910,-3.1672"
    
    # Get the route
    data = get_route(from_place, to_place, router=router)
    
    if data and "plan" in data and "itineraries" in data["plan"]:
        for i, itin in enumerate(data["plan"]["itineraries"]):
            print(f"\nRoute option {i+1}:")
            print(f"Total Duration: {itin['duration'] / 60:.1f} mins")
            for leg in itin["legs"]:
                print(f"  {leg['mode']} - {leg.get('route', '')} for {leg['duration'] / 60:.1f} mins")
    else:
        print("No route options found or invalid response format.")

if __name__ == "__main__":
    main()
