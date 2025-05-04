# Architecture Overview

## System Architecture

Location Score Analyzer follows a modern client-server architecture with the following components:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Frontend│     │  Flask Backend  │     │   Firebase      │
│   (Vite)        │◄───►│  (Python)       │◄───►│   (Firestore)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                       ▲                       ▲
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mapbox GL     │     │OpenTripPlanner  │     │   OpenRouteService │
│                 │     │    (OTP)        │     │       (ORS)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Component Details

### Frontend (React + Vite)

- **Technology Stack**
  - React 18
  - Vite
  - React Router
  - CSS Modules
  - Mapbox GL (not Leaflet)
  - Firebase Authentication

- **Key Features**
  - Component-based architecture
  - Responsive design
  - Real-time updates
  - Interactive maps
  - Score visualization
  - Transport mode comparison
  - System transparency displays

- **Directory Structure**
  ```
  client/
  ├── src/
  │   ├── components/
  │   ├── pages/
  │   ├── hooks/
  │   ├── utils/
  │   ├── services/
  │   └── styles/
  ├── public/
  └── tests/
  ```

### Backend (Python + Flask)

- **Technology Stack**
  - Python 3.8+
  - Flask
  - Pandas
  - Requests
  - OSMNX (OpenStreetMap for Python)

- **Key Features**
  - RESTful API
  - CORS support
  - Multi-modal transport routing
  - Transit accessibility analysis
  - LRU Caching for route calculations

- **Directory Structure**
  ```
  server/
  ├── app.py
  ├── gtfs_service.py
  ├── otp.py
  └── utils/
  ```

### Database (Firebase)

- **Services Used**
  - Firestore (NoSQL database)
  - Firebase Authentication
  - Firebase Storage
  - Firebase Analytics

- **Key Features**
  - Real-time data sync
  - User authentication
  - Document-based storage
  - Cloud storage for assets

## Transport System Architecture

### OpenRouteService (ORS)

- **Purpose**: Calculates travel times and routes for driving, cycling, and walking
- **Integration**: REST API calls from the backend
- **Features**:
  - Turn-by-turn directions
  - Distance calculations
  - Duration estimates
  - Route geometries

### OpenTripPlanner (OTP)

- **Purpose**: Calculates public transit journeys (bus routes)
- **Integration**: GraphQL API calls from the backend
- **Features**:
  - Multi-modal routing (transit + walking)
  - Schedule-based routing
  - Real-time updates (if GTFS-RT data available)
  - Fare calculations
  - Accessibility analysis

### Transport Mode Selection

- **Global Mode**: User can select a preferred transport mode for all destinations
- **Per-Destination Mode**: Individual transport modes can be set for specific destinations
- **Auto Mode**: System automatically selects the fastest transport mode for each journey
- **Fallback System**: When bus transit is unavailable, system falls back to alternative modes

## Data Flow

1. **Location Analysis Request**
   ```
   User Input → Frontend → Backend API → External APIs → Response → Firestore
   ```

2. **Score Calculation**
   ```
   Location Data → Travel Analysis → Amenity Analysis → Transit Analysis → Final Score
   ```

3. **Transport Calculation**
   ```
   Origin/Destination → Mode Selection → Route Calculation → Travel Time → Score Component
   ```

4. **Data Caching**
   ```
   Request → Cache Check → External API (if needed) → Cache Update → Response
   ```

## Security Architecture

- **Authentication**
  - Firebase Authentication
  - Google Sign-in
  - Content Security Policy

- **Data Protection**
  - HTTPS encryption
  - Input validation
  - Cross-Origin Resource Sharing (CORS) controls
  - XSS protection

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                       │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────┐
│                           │                             │
│    ┌──────────────┐       │      ┌──────────────┐       │
│    │  Frontend    │       │      │  Frontend    │       │
│    │  Container   │       │      │  Container   │       │
│    └──────────────┘       │      └──────────────┘       │
│                           │                             │
│    ┌──────────────┐       │      ┌──────────────┐       │
│    │  Backend     │       │      │  Backend     │       │
│    │  Container   │       │      │  Container   │       │
│    └──────────────┘       │      └──────────────┘       │
│                           │                             │
└───────────────────────────┼─────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────┐
│    ┌──────────────┐       │      ┌──────────────┐       │
│    │  Firebase    │       │      │   OTP        │       │
│    │  Cloud       │       │      │   Container  │       │
│    └──────────────┘       │      └──────────────┘       │
└───────────────────────────┴─────────────────────────────┘
```

## Performance Optimization

- **Frontend**
  - Code splitting
  - Lazy loading
  - Asset optimization
  - Service worker caching

- **Backend**
  - LRU caching for route calculations
  - Request throttling
  - Asynchronous processing

- **Firebase**
  - Denormalized data structure
  - Batched writes
  - Indexed queries

## Monitoring and Logging

- **Application Monitoring**
  - Error tracking
  - Performance metrics
  - User analytics (Firebase Analytics)
  - Resource usage

- **Infrastructure Monitoring**
  - Server health
  - Network status
  - OTP and ORS service availability
  - Firebase usage and quotas

## Future Considerations

- **Scalability**
  - Horizontal scaling
  - Microservices decomposition
  - Global distribution
  - Multi-region support

- **Features**
  - Machine learning integration
  - Real-time transit updates
  - Mobile applications
  - Advanced analytics
  - Additional transport modes (e.g., trams, trains)

## Development Workflow

1. **Local Development**
   - Hot reloading
   - Mock services
   - Local API testing

2. **Testing**
   - Unit tests
   - Integration tests
   - E2E tests
   - Performance tests

3. **Deployment**
   - CI/CD pipeline
   - Automated testing
   - Staging environment
   - Production deployment 