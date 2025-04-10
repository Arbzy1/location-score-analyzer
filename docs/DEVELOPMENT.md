# Development Guide

## Development Environment Setup

### Prerequisites

- Node.js (v14 or higher)
- Python (v3.8 or higher)
- PostgreSQL (v13 or higher)
- Git
- Docker (optional)

### Initial Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/location-score-analyzer.git
   cd location-score-analyzer
   ```

2. **Frontend Setup**
   ```bash
   cd source-code/client
   npm install
   ```

3. **Backend Setup**
   ```bash
   cd ../server
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Database Setup**
   ```bash
   createdb location_score
   python manage.py db upgrade
   ```

5. **Environment Variables**
   Create `.env` files in both client and server directories:

   ```env
   # client/.env
   VITE_API_URL=http://localhost:5000
   VITE_GOOGLE_MAPS_API_KEY=your_key_here

   # server/.env
   FLASK_APP=app
   FLASK_ENV=development
   DATABASE_URL=postgresql://localhost/location_score
   GOOGLE_MAPS_API_KEY=your_key_here
   ```

## Development Workflow

### 1. Branch Management

- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes

### 2. Code Style

#### Frontend (React)
- Use functional components with hooks
- Follow ESLint configuration
- Use CSS Modules for styling
- Follow component naming conventions

```jsx
// Good
const UserProfile = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  return (
    <div className={styles.profile}>
      {/* Component content */}
    </div>
  );
};

// Bad
function UserProfile(props) {
  var isEditing = false;
  // ...
}
```

#### Backend (Python)
- Follow PEP 8 style guide
- Use type hints
- Document functions and classes
- Use meaningful variable names

```python
# Good
def calculate_location_score(
    latitude: float,
    longitude: float,
    preferences: Dict[str, float]
) -> float:
    """
    Calculate the score for a given location based on user preferences.
    
    Args:
        latitude: Location latitude
        longitude: Location longitude
        preferences: User scoring preferences
        
    Returns:
        float: Calculated location score
    """
    # Implementation
    pass

# Bad
def score(lat, lon, prefs):
    # Implementation
    pass
```

### 3. Testing

#### Frontend Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/components/__tests__/LocationCard.test.jsx

# Run tests with coverage
npm test -- --coverage
```

#### Backend Tests
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_location_scoring.py

# Run tests with coverage
pytest --cov=app tests/
```

### 4. Code Review Process

1. Create pull request
2. Ensure CI checks pass
3. Request review from team members
4. Address feedback
5. Merge after approval

### 5. Documentation

- Update README.md for user-facing changes
- Update API.md for API changes
- Update ARCHITECTURE.md for architectural changes
- Add comments for complex logic
- Document environment variables

## Debugging

### Frontend Debugging

1. **React Developer Tools**
   - Install browser extension
   - Use component inspector
   - Check props and state

2. **Console Debugging**
   ```javascript
   // Add debug points
   console.log('Debug:', variable);
   console.table(arrayData);
   console.time('operation');
   // ... code ...
   console.timeEnd('operation');
   ```

### Backend Debugging

1. **Flask Debug Mode**
   ```python
   # Enable debug mode
   export FLASK_DEBUG=1
   ```

2. **Python Debugger**
   ```python
   import pdb; pdb.set_trace()
   # or
   breakpoint()
   ```

## Performance Optimization

### Frontend

1. **Code Splitting**
   ```javascript
   const MapView = lazy(() => import('./pages/MapView'));
   ```

2. **Memoization**
   ```javascript
   const MemoizedComponent = memo(Component);
   ```

3. **Virtual Lists**
   ```javascript
   import { FixedSizeList } from 'react-window';
   ```

### Backend

1. **Caching**
   ```python
   @cache.memoize(timeout=300)
   def get_location_score(location_id):
       # Implementation
   ```

2. **Database Optimization**
   ```python
   # Use select_from for complex queries
   query = db.session.query(Location).select_from(Score)
   ```

## Deployment

### Staging Deployment

1. **Build Frontend**
   ```bash
   cd source-code/client
   npm run build
   ```

2. **Deploy Backend**
   ```bash
   cd ../server
   gunicorn app:app
   ```

### Production Deployment

1. **Docker Deployment**
   ```bash
   docker-compose up -d
   ```

2. **Manual Deployment**
   ```bash
   # Frontend
   npm run build
   # Deploy build folder to CDN

   # Backend
   gunicorn app:app --workers 4
   ```

## Troubleshooting

### Common Issues

1. **Database Connection**
   ```bash
   # Check connection
   psql -d location_score
   
   # Reset database
   python manage.py db downgrade
   python manage.py db upgrade
   ```

2. **API Issues**
   ```bash
   # Check API status
   curl http://localhost:5000/health
   
   # Check logs
   tail -f logs/app.log
   ```

3. **Frontend Build Issues**
   ```bash
   # Clear cache
   npm cache clean --force
   
   # Reinstall dependencies
   rm -rf node_modules
   npm install
   ```

## Support

For development support:
- Email: dev-support@locationscorer.com
- Slack: #dev-support
- Documentation: https://docs.locationscorer.com 