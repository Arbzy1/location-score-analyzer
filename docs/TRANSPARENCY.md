# System Transparency

One of the key features of Location Score Analyzer is its commitment to complete transparency in how scores are calculated. This document explains the transparency features and how they can help users understand and trust our recommendations.

## Overview

The System Transparency feature provides a detailed breakdown of all data and calculations used to generate location scores. This helps users:

- Understand exactly how scores are derived
- Verify the accuracy of recommendations
- Build trust in the system
- Make more informed decisions

## Accessing Transparency Information

Each location card in the search results includes a collapsible "System Transparency" section. Click the dropdown arrow to expand this section and view detailed information about the location's score calculation.

## What Information is Provided

### Raw Data Used

#### Location Details
- Precise coordinates of the recommended location
- Area name based on OpenStreetMap data

#### Travel Calculation Data
- Travel times to each of your frequent destinations
- Distance estimates
- Transport mode used for each journey
- Weekly frequency of travel
- Total weekly time cost
- Comparison of all calculated transport modes

#### Transit Analysis
- Transit score out of 100
- Number of bus routes within walking distance
- Transit score calculation formula

#### Amenities Analysis
- Distance to each amenity type (schools, hospitals, supermarkets)
- Weight of each amenity in the final score
- Distance-adjusted score for each amenity
- Distance thresholds used for scoring

### Score Calculation Breakdown

The transparency section provides the exact formula used to calculate the final score:

```
Final Score = Travel Score (40%) + Amenities Score (40%) + Transit Score (20%)
```

You can see the exact values that went into this calculation:

- Travel Score: How the 40% travel component was calculated
- Amenities Score: How the 40% amenities component was calculated
- Transit Score: How the 20% transit component was calculated

All numerical values in the score calculations are rounded to one decimal place for better readability.

### System Methodology

The transparency section explains how the system works:

1. Random locations are generated within the requested city
2. Travel times are calculated using OpenStreetMap Routing Service and OpenTripPlanner
3. Nearby amenities are found using OpenStreetMap data
4. Public transit accessibility is analyzed using GTFS data
5. A comprehensive score is calculated based on these factors
6. The top scoring locations are presented to help you find your ideal area

## Travel Score Calculation

The travel score is calculated using the following formula:

```
Travel Score = max(0, (600 - total_weekly_time) / 600) * 40
```

Where:
- 600 is the maximum acceptable weekly travel time in minutes (10 hours)
- total_weekly_time is the sum of all your journey times multiplied by their weekly frequencies

This means that locations requiring less travel time receive higher scores.

## Amenities Score Calculation

Each amenity's score is calculated based on:
- The distance to the nearest amenity of that type
- The weight you've assigned to that amenity type
- A distance threshold that determines the maximum score (varies by amenity type)

The formula for each amenity is:
```
Amenity Score = max(0, 1 - (distance_km / threshold_km)) * weight
```

Where:
- Schools use a 2km threshold
- Hospitals use a 3km threshold
- Supermarkets use a 1km threshold

## Transit Score Calculation

The transit score is based on:
- Number of bus routes within walking distance
- Proximity to nearest bus stops
- Service frequency data (where available)

The raw transit score (0-100) is then weighted at 20% for the final score:
```
Transit Score Component = (raw_transit_score / 100) * 20
```

## Transport Mode Selection

When you select a specific transport mode (like bus), the system will:
- Calculate travel times using that mode for all destinations
- Use those times for the travel score calculation
- Still show comparative times for other modes for reference

If you select "auto" mode, the system will use the fastest mode for each journey in the score calculation.

When bus transit is selected but no bus route is available for a particular journey, the system will automatically fall back to an alternative mode (walking, cycling, or driving) to ensure a complete score can be calculated.

The TransportBreakdown component clearly indicates which mode was used for each journey with a checkmark, ensuring you can see exactly how your travel times were calculated.

## Data Sources

All data is sourced from:
- OpenStreetMap for mapping and amenity data
- OpenStreetMap Routing Service (OSRM) for driving, cycling, and walking times
- OpenTripPlanner for bus transit routing
- GTFS (General Transit Feed Specification) data for public transport schedules

## Questions and Feedback

If you have questions about how your scores are calculated or suggestions for improving our transparency features, please contact us at support@locationscorer.com. 