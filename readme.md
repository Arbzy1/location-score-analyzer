# Location Score Analyzer

![Location Score Analyzer](source-code/client/public/android-chrome-192x192.png)

A sophisticated web application that analyzes and scores residential locations based on travel times, amenities, and public transport accessibility. Built with React, Python, and modern web technologies.

## 🌟 Features

- **Comprehensive Location Analysis**
  - Travel time calculations
  - Amenity proximity scoring
  - Public transport accessibility
  - Customizable scoring weights

- **Interactive Maps**
  - Visual representation of locations
  - Real-time route visualization
  - Amenity markers and information

- **Advanced Scoring System**
  - 40% Travel Score
  - 40% Amenities Score
  - 20% Transit Score

- **User-Friendly Interface**
  - Responsive design
  - Intuitive navigation
  - Real-time updates

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Python (v3.8 or higher)
- npm or yarn

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
   ```

## 📊 Scoring System

### Travel Score (40%)
- Based on daily commute times
- Considers both work and school journeys
- Optimized for minimum travel time

### Amenities Score (40%)
- Weighted scoring for nearby amenities:
  - Schools (15 points)
  - Hospitals (4 points)
  - Supermarkets (21 points)

### Transit Score (20%)
- Based on public transport accessibility
- Considers bus route frequency
- Proximity to transit stops

## 🛠️ Technology Stack

### Frontend
- React
- Vite
- React Router
- CSS Modules
- Leaflet Maps

### Backend
- Python
- Flask
- SQLAlchemy
- Google Maps API
- Public Transport API

## 📝 Documentation

- [API Documentation](docs/API.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Testing Guide](docs/TESTING.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Your Name - Initial work - [YourGitHub](https://github.com/yourusername)

## 🙏 Acknowledgments

- Google Maps Platform
- Public Transport API providers
- OpenStreetMap contributors
- All contributors and supporters

## 📞 Contact

For support or inquiries, please contact:
- Email: support@locationscorer.com
- Website: https://locationscorer.com

---

<div align="center">
  <sub>Built with ❤️ by Your Name</sub>
</div>
