import json
import os

def test_top_schools():
    """Test that top-rated schools are properly loaded and can be matched with OSM data."""
    
    # Load top-rated schools data
    TOP_SECONDARY_SCHOOLS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'top_schools.json')
    TOP_PRIMARY_SCHOOLS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'top_primary_schools.json')
    
    print("Loading school data...")
    
    # Load secondary schools
    if os.path.exists(TOP_SECONDARY_SCHOOLS_FILE):
        with open(TOP_SECONDARY_SCHOOLS_FILE, 'r') as f:
            top_secondary_schools_dict = json.load(f)
        print(f"✅ Loaded {len(top_secondary_schools_dict)} top-rated secondary schools")
    else:
        print(f"⚠️ Top secondary schools file not found at {TOP_SECONDARY_SCHOOLS_FILE}")
        top_secondary_schools_dict = {}
        
    # Load primary schools
    if os.path.exists(TOP_PRIMARY_SCHOOLS_FILE):
        with open(TOP_PRIMARY_SCHOOLS_FILE, 'r') as f:
            top_primary_schools_dict = json.load(f)
        print(f"✅ Loaded {len(top_primary_schools_dict)} top-rated primary schools")
    else:
        print(f"⚠️ Top primary schools file not found at {TOP_PRIMARY_SCHOOLS_FILE}")
        top_primary_schools_dict = {}
    
    # Combine both dictionaries
    all_top_schools_dict = {**top_secondary_schools_dict, **top_primary_schools_dict}
    print(f"✅ Combined {len(all_top_schools_dict)} top-rated schools total")
    
    # Test specific school names that might be problematic
    test_schools = [
        "Whitchurch High School",
        "Whitchurch High School (Upper)",
        "St Teilo's CW High School",  # Different format in the file: "St Teilo's CW High School" vs "St Teilo's Church in Wales High School"
        "Cardiff High School"
    ]
    
    print("\nTesting specific school matches:")
    for school_name in test_schools:
        in_secondary = school_name in top_secondary_schools_dict
        in_primary = school_name in top_primary_schools_dict
        in_combined = school_name in all_top_schools_dict
        
        print(f"School: {school_name}")
        print(f"  In secondary schools list: {in_secondary}")
        print(f"  In primary schools list: {in_primary}")
        print(f"  In combined list: {in_combined}")
        
        if in_secondary:
            print(f"  Rating: {top_secondary_schools_dict[school_name]['rating']}")
            print(f"  Rank: {top_secondary_schools_dict[school_name]['rank']}")
    
    print("\nAll secondary schools:")
    for i, (name, data) in enumerate(top_secondary_schools_dict.items(), 1):
        print(f"{i}. {name}: Rank {data['rank']}, Rating: {data['rating']}")
    
    print("\nSchool filter test complete!")

if __name__ == "__main__":
    test_top_schools() 