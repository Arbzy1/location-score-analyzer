# Location Score Analyzer

DEMO:
https://youtu.be/dQODno6YMW4

![Location Score Analyzer](source-code/client/public/android-chrome-192x192.png)

A sophisticated web application that analyzes and scores residential locations based on travel times, amenities, and public transport accessibility. The system helps users find their ideal neighborhood by calculating comprehensive scores for different areas based on personalized travel preferences.

## 🌟 Features

- **Multi-Modal Transport Analysis**
  - Driving travel times via OpenStreetMap Routing Service
  - Cycling and walking routes
  - **Bus transit integration with OpenTripPlanner**
  - Automatic or user-selected transport modes

- **Comprehensive Location Scoring**
  - Travel time calculations to frequent destinations
  - Amenity proximity scoring (schools, hospitals, supermarkets)
  - Public transport accessibility ratings
  - Weekly travel time estimates
  - **Top School Recognition** highlighting Cardiff's best-rated schools

- **Interactive Maps**
  - Visual representation of recommended locations
  - Saved location markers
  - Amenity indicators
  - Area visualization

- **Advanced Customization**
  - Personalized travel preferences
  - Adjustable amenity importance weights
  - Transport mode selection (driving, cycling, walking, bus)
  - Frequency-based travel scoring

- **System Transparency**
  - Detailed score calculation breakdowns
  - Complete data transparency
  - Formula explanations
  - Raw data visibility

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Python (v3.8 or higher)
- npm or yarn
- OpenTripPlanner server (for bus transit feature)
- OpenStreetMap Routing Service (OSRM)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/location-score-analyzer.git
   cd location-score-analyzer
   ```

2. Install client dependencies:
   ```bash
   cd source-code/client
   npm install
   ```

3. Install server dependencies:
   ```bash
   cd ../server
   pip install -r requirements.txt
   ```

4. Start the development servers:
   ```bash
   # Terminal 1 - Client
   cd source-code/client
   npm run dev

   # Terminal 2 - Server
   cd source-code/server
   python app.py

   # Terminal 3 - OpenTripPlanner (required for bus transit)
   # Follow OTP setup instructions in docs/TRANSPORT.md
   ```

## 📊 Scoring System

### Travel Score (40%)
- Based on weekly travel times to frequent destinations
- Weighted by visit frequency
- Customizable transport mode selection (auto, driving, cycling, walking, bus)
- Target: Keep weekly travel time under 600 minutes

### Amenities Score (40%)
- Weighted scoring for nearby amenities:
  - Schools (customizable weight, default 15%)
  - Hospitals (customizable weight, default 15%)
  - Supermarkets (customizable weight, default 10%)
- Distance-based scoring with amenity-specific thresholds

### Transit Score (20%)
- Based on public transport accessibility
- Considers bus route frequency and coverage
- Proximity to transit stops

## 🌐 Transport Modes

The system supports multiple transport modes:

- **Auto**: Automatically selects the fastest mode for each journey
- **Driving**: Calculates routes using car travel times
- **Cycling**: Uses bicycle routing for all journeys
- **Walking**: Pedestrian-only routes
- **Bus Transit**: Public transport + walking routes

Each transport mode can be selected globally or per destination. When a global mode is selected, it overrides individual destination settings.

For bus transit, the system uses OpenTripPlanner to calculate journey times. If no bus route is available, the system will try to find an alternative transport mode as a fallback.

## 🛠️ Technology Stack

### Frontend
- React
- Firebase Authentication
- CSS

### Backend
- Python
- Flask
- ORS (Open Route Service)
- OpenTripPlanner (for public transit)
- Cardiff GTFS Data (General Transit Feed Specification)

## 📝 Documentation

- [API Documentation](docs/API.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Testing Guide](docs/TESTING.md)
- [Transport Setup Guide](docs/TRANSPORT.md)
- [System Transparency](docs/TRANSPARENCY.md)
- [Top School Feature](docs/TOP_SCHOOLS_FEATURE.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Aden Butt

## 🙏 Acknowledgments

- OpenStreetMap and OSRM contributors
- OpenTripPlanner project
- GTFS data providers
- Firebase for authentication
- All contributors and supporters


---

<div align="center">
  <sub></sub>
</div>
