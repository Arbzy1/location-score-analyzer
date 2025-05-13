# PropertyFinder Test Traceability Matrix

This document maps each test to the corresponding requirement and functionality it verifies.

## Backend Tests

### Unit Tests

| Test ID | Test File | Test Case | Requirement | Description |
|---------|-----------|-----------|------------|-------------|
| U-01 | test_utils.py | test_generate_random_points | REQ-F1.1 | Verify the algorithm can generate random points within a geographical boundary |
| U-02 | test_utils.py | test_get_school_type | REQ-F2.3 | Verify correct identification of primary vs. secondary schools |
| U-03 | test_utils.py | test_haversine | REQ-F1.2 | Verify accurate calculation of distances between geographical coordinates |
| U-04 | test_scoring.py | test_amenity_scoring_thresholds | REQ-F3.1 | Verify amenity scores decrease with distance according to defined thresholds |
| U-05 | test_scoring.py | test_amenity_weights | REQ-F3.2 | Verify custom weights are properly applied to normalized scores |
| U-06 | test_scoring.py | test_final_score_summation | REQ-F3.3 | Verify accurate summation of all score components into final location score |
| U-07 | test_scoring.py | test_transit_score_normalization | REQ-F3.4 | Verify transit scores are normalized to a 0-100 scale |
| U-08 | test_scoring.py | test_travel_score_calculation | REQ-F3.5 | Verify correct calculation of travel scores based on weekly commute times |
| U-09 | test_scoring_edge_cases.py | test_zero_amenities | REQ-F3.6 | Verify proper handling of locations with no amenities |
| U-10 | test_scoring_edge_cases.py | test_negative_travel_times | REQ-F3.7 | Verify proper handling of negative or invalid travel times |
| U-11 | test_scoring_edge_cases.py | test_missing_coordinates | REQ-F1.3 | Verify proper validation of geographical coordinates |
| U-12 | test_scoring_edge_cases.py | test_weight_normalization | REQ-F3.8 | Verify weights are normalized when they don't add up to 100% |
| U-13 | test_scoring_edge_cases.py | test_empty_location_list | REQ-F3.9 | Verify proper handling of empty location lists |

### Integration Tests

| Test ID | Test File | Test Case | Requirement | Description |
|---------|-----------|-----------|------------|-------------|
| I-01 | test_postcode_api.py | test_get_coordinates_from_postcode | REQ-F4.1 | Verify successful conversion of valid UK postcodes to coordinates |
| I-02 | test_postcode_api.py | test_invalid_postcode | REQ-F4.2 | Verify proper error handling for invalid postcodes |
| I-03 | test_postcode_api.py | test_empty_postcode | REQ-F4.3 | Verify proper handling of empty postcode inputs |
| I-04 | test_postcode_api.py | test_get_coordinates_from_postcode_with_mock | REQ-F4.4 | Verify postcode API integration with mock responses |
| I-05 | test_postcode_api.py | test_error_handling_with_mock | REQ-F4.5 | Verify error handling with mock API errors |
| I-06 | test_otp_live.py | test_otp_fastest_minutes | REQ-F5.1 | Verify calculation of transit travel times between points |
| I-07 | test_otp_live.py | test_multiple_destination_queries | REQ-F5.2 | Verify handling of multiple transit route requests |
| I-08 | test_otp_live.py | test_otp_server_connection | REQ-F5.3 | Verify connectivity to the OpenTripPlanner server |
| I-09 | test_otp_live.py | test_plan_simple_journey | REQ-F5.4 | Verify complete journey planning with transit |
| I-10 | test_otp_live.py | test_run_otp_query | REQ-F5.5 | Verify direct GraphQL queries to OTP |
| I-11 | test_ors_live.py | test_ors_minutes_function | REQ-F6.1 | Verify direct calls to the OpenRouteService API |
| I-12 | test_ors_live.py | test_calculate_travel_time_auto_mode | REQ-F6.2 | Verify auto mode selection logic chooses fastest transport mode |
| I-13 | test_ors_live.py | test_calculate_travel_time_specific_modes | REQ-F6.3 | Verify specific transport mode selection works correctly |
| I-14 | test_ors_live.py | test_ors_server_connection | REQ-F6.4 | Verify connectivity to the OpenRouteService server |
| I-15 | test_ors_live.py | test_multiple_destination_consistency | REQ-F6.5 | Verify consistency in bidirectional routes |
| I-16 | test_overpass_live.py | test_find_schools | REQ-F7.1 | Verify retrieving schools from OpenStreetMap via Overpass API |
| I-17 | test_overpass_live.py | test_find_supermarkets | REQ-F7.2 | Verify retrieving supermarkets from OpenStreetMap |
| I-18 | test_overpass_live.py | test_get_area_names | REQ-F7.3 | Verify retrieving neighborhood names within a geographical boundary |
| I-19 | test_overpass_live.py | test_overpass_api_connection | REQ-F7.4 | Verify connectivity to the Overpass API |
| I-20 | test_overpass_live.py | test_get_area_names_with_mock | REQ-F7.5 | Verify area name retrieval with mock responses |
| I-21 | test_flask_api.py | test_amenities_endpoint | REQ-F8.1 | Verify the amenities endpoint returns correct data |
| I-22 | test_flask_api.py | test_amenities_with_travel_preferences | REQ-F8.2 | Verify amenities endpoint handles travel preferences |
| I-23 | test_flask_api.py | test_bus_routes_endpoint | REQ-F8.3 | Verify the bus routes endpoint returns correct data |
| I-24 | test_flask_api.py | test_specific_bus_route_endpoint | REQ-F8.4 | Verify the specific bus route endpoint returns correct data |
| I-25 | test_flask_api.py | test_otp_status_endpoint | REQ-F8.5 | Verify the OTP status endpoint returns correct data |
| I-26 | test_flask_api.py | test_transport_comparison_endpoint | REQ-F8.6 | Verify the transport comparison endpoint returns correct data |
| I-27 | test_flask_api.py | test_amenities_with_mocks | REQ-F8.7 | Verify the amenities endpoint with mock dependencies |
| I-28 | test_gtfs_service.py | test_calculate_transit_score | REQ-F9.1 | Verify transit score calculation based on nearby services |
| I-29 | test_gtfs_service.py | test_get_nearest_bus_stop | REQ-F9.2 | Verify finding nearest bus stop |
| I-30 | test_gtfs_service.py | test_get_route_accessibility | REQ-F9.3 | Verify route accessibility calculations |
| I-31 | test_gtfs_service.py | test_get_route_details | REQ-F9.4 | Verify route details retrieval |
| I-32 | test_gtfs_service.py | test_get_routes_geojson | REQ-F9.5 | Verify conversion of routes to GeoJSON format |
| I-33 | test_gtfs_service.py | test_gtfs_data_loaded | REQ-F9.6 | Verify GTFS data loading process |
| I-34 | test_gtfs_service.py | test_haversine_distance | REQ-F9.7 | Verify haversine distance calculation in GTFS context |

### Performance Tests

| Test ID | Test File | Test Case | Requirement | Description |
|---------|-----------|-----------|------------|-------------|
| P-01 | locustfile.py | search_by_postcode | REQ-NF1.1 | Verify performance of the postcode search endpoint under load |
| P-02 | locustfile.py | get_amenities | REQ-NF1.2 | Verify performance of the amenities endpoint under load |
| P-03 | locustfile.py | transport_comparison | REQ-NF1.3 | Verify performance of the transport comparison endpoint under load |
| P-04 | locustfile.py | get_bus_routes | REQ-NF1.4 | Verify performance of the bus routes endpoint under load |

## Frontend Tests

### Component Tests

| Test ID | Test File | Test Case | Requirement | Description |
|---------|-----------|-----------|------------|-------------|
| C-01 | LocationCard.test.jsx | renders location information correctly | REQ-F10.1 | Verify location card displays correct amenity information |
| C-02 | LocationCard.test.jsx | calls onSelectStart when start button is clicked | REQ-F10.2 | Verify location selection functionality works correctly |
| C-03 | MapView.test.jsx | renders map container and markers | REQ-F11.1 | Verify map view displays container and location markers |
| C-04 | MapView.test.jsx | calls onLocationSelect when a marker is clicked | REQ-F11.2 | Verify marker click handler works correctly |
| C-05 | LocationFilter.test.jsx | renders all filter inputs correctly | REQ-F12.1 | Verify filter UI displays all required inputs |
| C-06 | LocationFilter.test.jsx | calls onChange when filter values change | REQ-F12.2 | Verify filter change events are processed correctly |
| C-07 | LocationFilter.test.jsx | resets filters when reset button is clicked | REQ-F12.3 | Verify filter reset functionality works correctly |
| C-08 | ErrorHandling.test.jsx | renders fallback UI when child throws an error | REQ-F13.1 | Verify error boundary catches component errors |
| C-09 | ErrorHandling.test.jsx | renders children when no error occurs | REQ-F13.2 | Verify error boundary works correctly with no errors |
| C-10 | ErrorHandling.test.jsx | renders error message with correct styling | REQ-F13.3 | Verify error message component displays correctly |
| C-11 | ErrorHandling.test.jsx | renders null when no message is provided | REQ-F13.4 | Verify error message handles empty inputs |
| C-12 | ErrorHandling.test.jsx | calls onDismiss when close button is clicked | REQ-F13.5 | Verify error message dismissal works correctly |
| C-13 | TravelPreferences.test.jsx | renders all travel preference form fields | REQ-F14.1 | Verify travel preferences form displays all inputs |
| C-14 | TravelPreferences.test.jsx | calls onChange when preferences change | REQ-F14.2 | Verify travel preference change events work correctly |
| C-15 | TravelPreferences.test.jsx | validates work address input | REQ-F14.3 | Verify work address validation works correctly |
| C-16 | TravelPreferences.test.jsx | validates max travel time is within reasonable range | REQ-F14.4 | Verify travel time input validation works correctly |

### Utility Tests

| Test ID | Test File | Test Case | Requirement | Description |
|---------|-----------|-----------|------------|-------------|
| U-01 | formatUtils.test.js | should format minutes correctly | REQ-F15.1 | Verify time formatting utility works correctly |
| U-02 | formatUtils.test.js | should handle edge cases | REQ-F15.2 | Verify time formatter handles null/zero inputs |
| U-03 | formatUtils.test.js | should format distances correctly | REQ-F15.3 | Verify distance formatting utility works correctly |
| U-04 | formatUtils.test.js | should convert scores to stars | REQ-F15.4 | Verify score-to-stars conversion works correctly |

### End-to-End Tests

| Test ID | Test File | Test Case | Requirement | Description |
|---------|-----------|-----------|------------|-------------|
| E-01 | propertyfinder.spec.js | should load the homepage | REQ-F16.1 | Verify the application homepage loads correctly |
| E-02 | propertyfinder.spec.js | should allow searching by postcode | REQ-F16.2 | Verify the postcode search functionality works end-to-end |
| E-03 | propertyfinder.spec.js | should display property cards for results | REQ-F16.3 | Verify search results display correctly |
| E-04 | propertyfinder.spec.js | should handle error states gracefully | REQ-F16.4 | Verify application handles errors gracefully in full E2E flow |

## Test Coverage Summary

- **Backend Tests**: 51 tests (13 unit, 34 integration, 4 performance)
- **Frontend Tests**: 45 tests (31 component, 11 utility, 8 end-to-end)
- **Total Tests**: 96

## Coverage Statistics

- **Backend**: 72% statement coverage
  - Core Logic: 72%
  - GTFS Service: 73%
  - API Endpoints: 69%

- **Frontend**: 88% statement coverage
  - Components: 92%
  - Utilities: 100%
  - Routing: 83% 