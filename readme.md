# PropertyFinder

A smart location finder that helps users find the ideal place to live based on their travel patterns, amenity preferences, and public transport needs.

## Scoring System

The PropertyFinder uses a sophisticated 100-point scoring system divided into three main components:

### 1. Travel Behaviour Score (40 Points)

The Travel Behaviour component evaluates how convenient a location is in terms of travel to the places a user regularly visits. This makes up 40% of the total score.

#### User Input
Users provide a list of frequent destinations, such as:
- Home
- Work
- School

For each location, the user specifies:
- A UK postcode
- How many times they travel there per week

#### Location Mapping
Each postcode is geocoded using the [postcodes.io](https://postcodes.io/) API to retrieve its latitude and longitude.

#### Travel Time Calculation
For every candidate location in the city:
- The system calculates driving times to each destination using [OSRM](http://project-osrm.org/) (Open Source Routing Machine)
- These are real travel durations based on the road network—not straight-line distances

#### Frequency Weighting
Each destination is weighted based on how often it is visited.

For example:
- **Home**: 7 visits per week
- **Work**: 5 visits per week
- **Total weekly trips** = 12

The system then calculates:
- Home weight: 7 ÷ 12 = **0.58**
- Work weight: 5 ÷ 12 = **0.42**

This ensures destinations you visit more often have a bigger influence on the final score.

#### Penalty System
For each destination:
- The travel time is multiplied by its frequency weight
- All weighted times (penalties) are summed

This gives a **weekly penalty**, which is then averaged over 5 weekdays to get a **daily travel time**.

#### Scoring Formula
The system uses a target of 120 minutes of daily travel (combined).

Scores decrease linearly as travel time increases:
```python
travel_score = max(0, (120 - daily_penalty) / 120) * 40
```

Examples:
- If daily travel time = 0 mins → **40/40 points**
- If daily travel time = 60 mins → **20/40 points**
- If daily travel time = 120+ mins → **0/40 points**

### 2. Amenities Score (40 Points)

The Amenities Score assesses how well a location meets your everyday needs. It accounts for up to **40 points** of the overall score, and is based on the distance to key services like schools, hospitals, and supermarkets.

#### User Preference Weights
Users can assign importance (weight) to each amenity type.

The combined total must equal **40 points**.

**Example**:
- Schools → 15 points
- Hospitals → 10 points
- Supermarkets → 15 points
    
    **Total** = 40 points

If no custom preferences are provided, the system uses default weights:
```python
{
  "school": 15,
  "hospital": 15,
  "supermarket": 10
}
```

#### Amenity Data Collection
The system uses OpenStreetMap (via OSMnx) to find all:
- `amenity=school`
- `amenity=hospital`
- `shop=supermarket`

These are retrieved for the entire city being analyzed.

#### Proximity-Based Scoring
For each candidate location, the distance to the **nearest** amenity of each type is calculated.

Then, the score for each type is determined using a **linear decay function**, which rewards locations that are closer to these amenities.

#### Scoring Formulas by Type:
```python
# Normalized score (0–1 scale)
school:     score = max(0, 1 - (distance_km / 2))  # Up to 2km
hospital:   score = max(0, 1 - (distance_km / 3))  # Up to 3km
supermarket:score = max(0, 1 - (distance_km / 1))  # Up to 1km
```

#### Example:
- School 1 km away → 0.5 normalized score → 0.5 × 15 = **7.5 points**
- Hospital 1.5 km away → 0.5 × 10 = **5 points**
- Supermarket 0.3 km away → 0.7 × 15 = **10.5 points**

Total = 7.5 + 5 + 10.5 = **23 points out of 40**

#### Breakdown and Storage
Each location stores the following for every amenity type:
- Name and coordinates of the nearest amenity
- Exact distance (in meters)
- Score (based on the distance and weight)
- Max possible score for that type

This is used for:
- Showing breakdowns to the user
- Visualizing amenities on the map

### 3. Transit Score (20 Points)

The **Transit Score** evaluates how well-connected a location is by **public transport**, specifically **bus accessibility** based on real GTFS (bus timetable) data. It contributes **20 points** to the overall location score.

#### Two-Part Scoring System
The score is made up of:
- **Route Accessibility (70%)** → based on how many bus routes serve nearby stops
- **Stop Proximity (30%)** → based on how close the nearest stop is

These add up to a **transit score out of 100**, which is then scaled to **20 points**:
```python
transit_weighted_score = (transit_score / 100) * 20
```

#### How It Works

##### 🚌 A. Route Accessibility (up to 70 points)
- The system finds the **nearest bus stop within 500m**
- It looks up all the **routes** that pass through that stop
- Each route adds **10 points**, capped at **70 points (7 routes)**

**Example**:
- 5 bus routes → 5 × 10 = **50 points**

##### 🚶 B. Stop Proximity (up to 30 points)
- Finds the **closest bus stop** within a **1000m** radius
- Calculates walking distance using Haversine formula
- Full 30 points if the stop is **right next to you**
- Score decreases linearly the farther away the stop is, until 500m:
```python
distance_score = max(30 * (1 - min_distance / 500), 0)
```

**Example**:
- Stop 100m away → (1 - 100/500) = 0.8 → 0.8 × 30 = **24 points**
- Stop 600m away → beyond the scoring range → **0 points**

#### Final Transit Score Example
Let's say:
- 6 bus routes nearby → 60 points
- Closest stop is 200m away → (1 - 200/500) = 0.6 × 30 = 18 points
- Raw transit score = 60 + 18 = **78/100**
- Scaled: (78 / 100) × 20 = **15.6 / 20 points**

## Example Location Breakdown: Leckwith

**Final Score: 83.4 / 100**

### Travel & Transit Analysis
- **Average Daily Travel Time:** 35 mins
- **Transit Score:** 87.7 / 100
- **Accessible Bus Routes:** 6

### Journey Details:
| Destination | Postcode | Frequency | One-way Time | Weekly Total |
| --- | --- | --- | --- | --- |
| School | CF63 4ZZ | 6x/week | 19 mins | 112 mins |
| School | CF11 0JR | 5x/week | 5 mins | 27 mins |
| Work | CF24 4DS | 3x/week | 11 mins | 34 mins |

**Total Weekly Travel Time:** 173 mins
**Average Daily Travel Time:** 173 / 5 = **34.6 mins**
→ Well below the 120-minute daily target
→ **Travel Score: 28 / 40**

### 🏙️ Amenities Score (User-weighted total: 40 points)
User has set preferences like this:
- **Schools: 15 points**
- **Hospitals: 4 points**
- **Supermarkets: 21 points**

#### 🏥 Hospital:
- Nearest: *Saint David's Hospital*
- Distance: **1.35 km**
- Formula: `1 - (1.35 / 3)` = 0.55
- Score: 0.55 × 4 = **2.2 / 4**

#### 🏫 School:
- Nearest: *Fitzalan High School*
- Distance: **316m (0.316 km)**
- Formula: `1 - (0.316 / 2)` ≈ 0.84
- Score: 0.84 × 15 ≈ **12.6 / 15**

#### 🛒 Supermarket:
- Nearest: *Lidl*
- Distance: **278m (0.278 km)**
- Formula: `1 - (0.278 / 1)` ≈ 0.72
- Score: 0.72 × 21 ≈ **15.2 / 21**

**Total Amenity Score: 2.2 + 12.6 + 15.2 = 30 / 40**

### 🚌 Public Transport Score
- **Routes nearby:** 6 → 6 × 10 = **60 / 70 points**
- **Nearest bus stop distance:** around 150m
    → Distance score = `1 - (150 / 500)` = 0.7 × 30 = **21 / 30**
    → Raw transit score: 60 + 21 = **81 / 100**
    → Weighted: `(87.7 / 100) × 20 = 17.5` → **Rounded: 18 / 20**

### 🎯 Final Score Summary
| Component | Points Earned | Max Points |
| --- | --- | --- |
| Travel | 28 | 40 |
| Amenities | 30 | 40 |
| Transit | 18 | 20 |
| **Total** | **83.4** | **100** |
