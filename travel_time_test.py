import requests
import pandas as pd
from tabulate import tabulate
import json
import time
from datetime import datetime
import csv
import sys
import webbrowser

# API Endpoint
BASE_URL = "http://localhost:5000"
TRANSPORT_ENDPOINT = f"{BASE_URL}/transport-comparison"

# Define Cardiff locations with their coordinates
CARDIFF_LOCATIONS = {
    "City Centre": {"lat": 51.481, "lon": -3.179},
    "Cardiff Bay": {"lat": 51.465, "lon": -3.165},
    "Heath Park": {"lat": 51.511, "lon": -3.175},
    "Roath": {"lat": 51.493, "lon": -3.165},
    "Cathays": {"lat": 51.488, "lon": -3.179},
    "Llandaff": {"lat": 51.495, "lon": -3.215},
    "Canton": {"lat": 51.483, "lon": -3.202},
    "Grangetown": {"lat": 51.472, "lon": -3.185},
    "Splott": {"lat": 51.475, "lon": -3.156},
    "Ely": {"lat": 51.483, "lon": -3.244}
}

# Transport modes to test
TRANSPORT_MODES = ["auto", "driving", "cycling", "walking", "bus"]

# Google Maps comparison data - pre-filled with some examples
# You can add more manually or through the interactive mode
GOOGLE_MAPS_TIMES = {
    "City Centre-Cardiff Bay": {"driving": 8, "cycling": 12, "walking": 25, "transit": 14},
    "City Centre-Heath Park": {"driving": 12, "cycling": 17, "walking": 38, "transit": 22},
    "Roath-Cardiff Bay": {"driving": 10, "cycling": 15, "walking": 30, "transit": 20},
    "Llandaff-City Centre": {"driving": 11, "cycling": 15, "walking": 35, "transit": 18}
}

# Map API transport modes to Google Maps URL parameters
GOOGLE_MAPS_MODE_PARAMS = {
    "driving": "driving",
    "cycling": "bicycling",
    "walking": "walking",
    "bus": "transit",
    "auto": "driving"  # Default to driving for auto
}

def test_travel_time(origin, destination):
    """
    Test travel time between two locations for all transport modes
    
    Args:
        origin (dict): Origin location with lat and lon
        destination (dict): Destination location with lat and lon
        
    Returns:
        dict: API response with travel times
    """
    params = {
        "from_lat": origin["lat"],
        "from_lon": origin["lon"],
        "to_lat": destination["lat"],
        "to_lon": destination["lon"]
    }
    
    try:
        response = requests.get(TRANSPORT_ENDPOINT, params=params)
        response.raise_for_status()  # Raise exception for 4XX/5XX errors
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error querying API: {e}")
        return None

def run_tests():
    """Run travel time tests for predefined origin-destination pairs"""
    
    # Define test cases: (origin_name, destination_name, modes_to_test)
    test_cases = [
        ("City Centre", "Cardiff Bay", TRANSPORT_MODES),
        ("City Centre", "Heath Park", TRANSPORT_MODES),
        ("Roath", "Cardiff Bay", TRANSPORT_MODES),
        ("Llandaff", "City Centre", TRANSPORT_MODES),
        ("Cathays", "Heath Park", TRANSPORT_MODES),
        ("Grangetown", "Roath", TRANSPORT_MODES),
        ("Canton", "Cardiff Bay", TRANSPORT_MODES),
        ("Splott", "Ely", TRANSPORT_MODES)
    ]
    
    results = []
    
    for origin_name, dest_name, modes in test_cases:
        origin = CARDIFF_LOCATIONS[origin_name]
        destination = CARDIFF_LOCATIONS[dest_name]
        
        print(f"Testing: {origin_name} → {dest_name}")
        response = test_travel_time(origin, destination)
        
        if response and "travel_modes" in response:
            row = {
                "Origin": origin_name,
                "Destination": dest_name,
                "Distance (km)": calculate_distance(origin, destination)
            }
            
            # Add travel times for each mode
            for mode in modes:
                if mode in response["travel_modes"] and "duration_minutes" in response["travel_modes"][mode]:
                    duration = response["travel_modes"][mode]["duration_minutes"]
                    row[f"{mode.capitalize()} (min)"] = round(duration, 1)
                else:
                    row[f"{mode.capitalize()} (min)"] = "N/A"
            
            # Add optimal mode
            if "optimal_mode" in response:
                row["Optimal Mode"] = response["optimal_mode"]
            
            results.append(row)
            
            # Add a small delay to avoid overwhelming the API
            time.sleep(0.5)
        else:
            print(f"Error: No valid response for {origin_name} → {dest_name}")
    
    return results

def calculate_distance(origin, destination):
    """
    Calculate distance between two coordinates in kilometers
    
    Args:
        origin (dict): Origin location with lat and lon
        destination (dict): Destination location with lat and lon
        
    Returns:
        float: Distance in kilometers
    """
    import math
    
    # Earth radius in kilometers
    R = 6371
    
    # Convert coordinates to radians
    lat1 = math.radians(origin["lat"])
    lon1 = math.radians(origin["lon"])
    lat2 = math.radians(destination["lat"])
    lon2 = math.radians(destination["lon"])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Calculate distance
    distance = R * c
    
    return round(distance, 2)

def save_results_to_csv(results, filename=None):
    """Save results to CSV file"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"travel_times_{timestamp}.csv"
    
    with open(filename, 'w', newline='') as csvfile:
        fieldnames = results[0].keys()
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for row in results:
            writer.writerow(row)
    
    print(f"Results saved to {filename}")
    return filename

def save_results_to_markdown(results, filename=None):
    """Save results to Markdown file for easy sharing"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"travel_times_{timestamp}.md"
    
    with open(filename, 'w', encoding='utf-8') as mdfile:
        # Write header
        mdfile.write("# Cardiff Travel Time Analysis\n\n")
        mdfile.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # Write table
        mdfile.write("## Travel Times Between Locations\n\n")
        mdfile.write("| Origin | Destination | Distance (km) | Driving (min) | Cycling (min) | Walking (min) | Bus (min) | Optimal Mode |\n")
        mdfile.write("|--------|-------------|---------------|---------------|---------------|---------------|-----------|-------------|\n")
        
        for row in results:
            mdfile.write(f"| {row['Origin']} | {row['Destination']} | {row['Distance (km)']} | ")
            mdfile.write(f"{row.get('Driving (min)', 'N/A')} | {row.get('Cycling (min)', 'N/A')} | ")
            mdfile.write(f"{row.get('Walking (min)', 'N/A')} | {row.get('Bus (min)', 'N/A')} | {row.get('Optimal Mode', 'N/A')} |\n")
        
        # Add summary if available
        if len(results) > 0:
            df = pd.DataFrame(results)
            numeric_columns = [col for col in df.columns if any(mode in col.lower() for mode in 
                             ["driving", "cycling", "walking", "bus"]) and "min" in col.lower()]
            
            if numeric_columns:
                mdfile.write("\n## Summary Statistics (minutes)\n\n")
                summary = df[numeric_columns].describe()
                
                # Format summary table
                mdfile.write("| Statistic | " + " | ".join(col for col in summary.columns) + " |\n")
                mdfile.write("|" + "-" * 10 + "|" + "|".join("-" * 15 for _ in summary.columns) + "|\n")
                
                for idx in summary.index:
                    mdfile.write(f"| {idx} | ")
                    values = []
                    for col in summary.columns:
                        values.append(f"{summary.loc[idx, col]:.1f}")
                    mdfile.write(" | ".join(values) + " |\n")
        
        # Add Google Maps comparison if available
        if hasattr(results, 'google_comparison') and results.google_comparison:
            mdfile.write("\n## Comparison with Google Maps\n\n")
            mdfile.write("| Route | Mode | API Time (min) | Google Maps Time (min) | Difference (min) | Difference (%) |\n")
            mdfile.write("|-------|------|----------------|------------------------|------------------|----------------|\n")
            
            for item in results.google_comparison:
                mdfile.write(f"| {item['route']} | {item['mode']} | {item['api_time']} | ")
                mdfile.write(f"{item['google_time']} | {item['diff_min']} | {item['diff_percent']}% |\n")
    
    print(f"Results saved to markdown file: {filename}")
    return filename

def compare_with_google_maps(api_results):
    """
    Compare API results with Google Maps times
    
    Args:
        api_results: List of dictionaries with API time results
        
    Returns:
        list: Comparison results
    """
    comparison_results = []
    
    # Map API mode names to Google Maps mode names
    mode_mapping = {
        "Driving (min)": "driving",
        "Cycling (min)": "cycling", 
        "Walking (min)": "walking",
        "Bus (min)": "transit"
    }
    
    for row in api_results:
        origin = row["Origin"]
        destination = row["Destination"]
        route_key = f"{origin}-{destination}"
        
        # Check if we have Google Maps data for this route
        if route_key in GOOGLE_MAPS_TIMES:
            google_data = GOOGLE_MAPS_TIMES[route_key]
            
            # Compare each mode
            for api_mode, google_mode in mode_mapping.items():
                if api_mode in row and google_mode in google_data:
                    api_time = row[api_mode]
                    google_time = google_data[google_mode]
                    
                    # Skip if API time is N/A
                    if api_time == "N/A":
                        continue
                    
                    # Calculate difference
                    diff_min = round(api_time - google_time, 1)
                    diff_percent = round((diff_min / google_time) * 100, 1)
                    
                    comparison_results.append({
                        "route": f"{origin} to {destination}",
                        "mode": google_mode,
                        "api_time": api_time,
                        "google_time": google_time,
                        "diff_min": diff_min,
                        "diff_percent": diff_percent
                    })
    
    return comparison_results

def input_google_maps_times():
    """Interactive function to input Google Maps times for routes"""
    print("\n===== Google Maps Time Entry =====")
    print("Enter times manually from Google Maps for comparison")
    
    while True:
        # Show available locations
        print("\nAvailable locations:")
        for i, loc in enumerate(CARDIFF_LOCATIONS.keys()):
            print(f"{i+1}. {loc}")
        
        # Get origin and destination
        try:
            origin_idx = int(input("\nSelect origin (number): ")) - 1
            dest_idx = int(input("Select destination (number): ")) - 1
            
            origin = list(CARDIFF_LOCATIONS.keys())[origin_idx]
            destination = list(CARDIFF_LOCATIONS.keys())[dest_idx]
            
            route_key = f"{origin}-{destination}"
            print(f"\nEntering times for route: {origin} to {destination}")
            
            # Get times for each mode
            driving = float(input("Driving time (min): "))
            cycling = float(input("Cycling time (min): "))
            walking = float(input("Walking time (min): "))
            transit = float(input("Transit/Bus time (min): "))
            
            # Save to global dictionary
            GOOGLE_MAPS_TIMES[route_key] = {
                "driving": driving,
                "cycling": cycling,
                "walking": walking,
                "transit": transit
            }
            
            print(f"Times saved for {route_key}")
            
            # Check if user wants to add more
            more = input("\nAdd another route? (y/n): ").lower()
            if more != 'y':
                break
                
        except (ValueError, IndexError) as e:
            print(f"Error: {e}. Please try again.")
        except KeyboardInterrupt:
            print("\nInput cancelled. Exiting entry mode.")
            break
    
    # Print summary of entered data
    print("\nGoogle Maps Data:")
    for route, times in GOOGLE_MAPS_TIMES.items():
        print(f"{route}: {times}")
    
    return GOOGLE_MAPS_TIMES

def open_in_google_maps(origin_name, destination_name, transport_mode="driving"):
    """
    Open Google Maps in a browser for the specified route and transport mode
    
    Args:
        origin_name (str): Name of origin location
        destination_name (str): Name of destination location
        transport_mode (str): Transport mode to use
    """
    if origin_name not in CARDIFF_LOCATIONS or destination_name not in CARDIFF_LOCATIONS:
        print(f"Error: One or both locations not found in defined Cardiff locations")
        return False
        
    origin = CARDIFF_LOCATIONS[origin_name]
    destination = CARDIFF_LOCATIONS[destination_name]
    
    # Convert transport mode to Google Maps parameter
    if transport_mode.lower() in GOOGLE_MAPS_MODE_PARAMS:
        mode_param = GOOGLE_MAPS_MODE_PARAMS[transport_mode.lower()]
    else:
        print(f"Warning: Unsupported transport mode '{transport_mode}'. Using driving as default.")
        mode_param = "driving"
        
    # Create Google Maps URL
    google_maps_url = (
        f"https://www.google.com/maps/dir/?api=1"
        f"&origin={origin['lat']},{origin['lon']}"
        f"&destination={destination['lat']},{destination['lon']}"
        f"&travelmode={mode_param}"
    )
    
    print(f"Opening Google Maps for route: {origin_name} to {destination_name} ({mode_param} mode)")
    
    # Open URL in browser
    webbrowser.open(google_maps_url)
    return True

def input_route_for_google_maps():
    """Interactive function to select a route and open it in Google Maps"""
    print("\n===== Open Route in Google Maps =====")
    
    # Show available locations
    print("\nAvailable locations:")
    for i, loc in enumerate(CARDIFF_LOCATIONS.keys()):
        print(f"{i+1}. {loc}")
    
    # Get origin and destination
    try:
        origin_idx = int(input("\nSelect origin (number): ")) - 1
        dest_idx = int(input("Select destination (number): ")) - 1
        
        origin = list(CARDIFF_LOCATIONS.keys())[origin_idx]
        destination = list(CARDIFF_LOCATIONS.keys())[dest_idx]
        
        # Get transport mode
        print("\nAvailable transport modes:")
        for i, mode in enumerate(["driving", "cycling", "walking", "transit"]):
            print(f"{i+1}. {mode}")
        
        mode_idx = int(input("\nSelect transport mode (number): ")) - 1
        mode = ["driving", "cycling", "walking", "transit"][mode_idx]
        
        # Open in Google Maps
        open_in_google_maps(origin, destination, mode)
        
    except (ValueError, IndexError) as e:
        print(f"Error: {e}. Please try again.")
    except KeyboardInterrupt:
        print("\nInput cancelled.")

def run_interactive_mode():
    """Run the script in interactive mode with menu options"""
    while True:
        print("\n===== Cardiff Travel Time Tester =====")
        print("1. Run travel time tests")
        print("2. Enter Google Maps times")
        print("3. Run comparison with Google Maps")
        print("4. Open route in Google Maps")
        print("5. Save results to CSV")
        print("6. Save results to Markdown")
        print("7. Exit")
        
        choice = input("\nEnter your choice (1-7): ")
        
        if choice == '1':
            global results
            results = run_tests()
            
            if results:
                print("\nTravel Time Results:")
                print(tabulate(results, headers="keys", tablefmt="grid"))
                
                # Summary statistics
                df = pd.DataFrame(results)
                numeric_columns = [col for col in df.columns if any(mode in col.lower() for mode in 
                                 ["auto", "driving", "cycling", "walking", "bus"]) and "min" in col.lower()]
                
                if numeric_columns:
                    print("\nSummary Statistics (minutes):")
                    summary = df[numeric_columns].describe()
                    print(tabulate(summary, headers="keys", tablefmt="grid"))
                
                # Mode comparison
                print("\nMode Comparison:")
                optimal_mode_counts = df["Optimal Mode"].value_counts()
                print(optimal_mode_counts)
        
        elif choice == '2':
            input_google_maps_times()
        
        elif choice == '3':
            if 'results' not in globals() or not results:
                print("No API results available. Please run tests first.")
                continue
                
            comparison = compare_with_google_maps(results)
            
            if comparison:
                print("\nComparison with Google Maps:")
                print(tabulate(comparison, headers="keys", tablefmt="grid"))
                
                # Save comparison to results for later export
                results.google_comparison = comparison
            else:
                print("No comparison data available. Please enter Google Maps times first.")
        
        elif choice == '4':
            input_route_for_google_maps()
        
        elif choice == '5':
            if 'results' not in globals() or not results:
                print("No results available. Please run tests first.")
                continue
                
            filename = input("Enter filename (or press Enter for auto-generated name): ")
            if not filename:
                filename = None
            save_results_to_csv(results, filename)
        
        elif choice == '6':
            if 'results' not in globals() or not results:
                print("No results available. Please run tests first.")
                continue
                
            filename = input("Enter filename (or press Enter for auto-generated name): ")
            if not filename:
                filename = None
            save_results_to_markdown(results, filename)
        
        elif choice == '7':
            print("Exiting program.")
            break
        
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    print("Cardiff Travel Time Tester")
    print(f"API Endpoint: {TRANSPORT_ENDPOINT}")
    
    # Check if the API is available
    try:
        test_response = requests.get(f"{BASE_URL}/transport-comparison", 
                                    params={"from_lat": 51.481, "from_lon": -3.179, 
                                           "to_lat": 51.465, "to_lon": -3.165},
                                    timeout=5)
        test_response.raise_for_status()
        print("✅ API is available and responding")
    except requests.exceptions.RequestException as e:
        print(f"❌ Error: Cannot connect to the API. {e}")
        print("Please make sure the PropertyFinder server is running at " + BASE_URL)
        sys.exit(1)
    
    # Check command line arguments
    if len(sys.argv) > 1 and sys.argv[1] == "--batch":
        # Run in batch mode
        print("Running in batch mode...")
        results = run_tests()
        
        if results:
            # Save results to CSV
            save_results_to_csv(results)
            
            # Save to Markdown as well
            save_results_to_markdown(results)
            
            # Run comparison if Google Maps data is available
            comparison = compare_with_google_maps(results)
            if comparison:
                print("\nComparison with Google Maps:")
                print(tabulate(comparison, headers="keys", tablefmt="grid"))
    else:
        # Run in interactive mode
        run_interactive_mode() 