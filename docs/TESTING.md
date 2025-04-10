# Testing Guide

## Overview

Location Score Analyzer uses a comprehensive testing strategy that includes unit tests, integration tests, and end-to-end tests. This guide outlines our testing approach and best practices.

## Testing Stack

### Frontend
- Jest
- React Testing Library
- Cypress
- MSW (Mock Service Worker)

### Backend
- pytest
- pytest-cov
- pytest-mock
- pytest-asyncio

## Test Types

### 1. Unit Tests

#### Frontend Unit Tests

```javascript
// LocationCard.test.jsx
import { render, screen } from '@testing-library/react';
import LocationCard from './LocationCard';

describe('LocationCard', () => {
  const mockLocation = {
    id: 1,
    name: 'Test Location',
    score: 85,
    coordinates: { lat: 51.5074, lng: -0.1278 }
  };

  it('renders location information correctly', () => {
    render(<LocationCard location={mockLocation} />);
    
    expect(screen.getByText('Test Location')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('handles missing data gracefully', () => {
    render(<LocationCard location={{}} />);
    
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
```

#### Backend Unit Tests

```python
# test_location_scoring.py
import pytest
from app.services.scoring import calculate_location_score

def test_calculate_location_score():
    # Arrange
    location = {
        'latitude': 51.5074,
        'longitude': -0.1278
    }
    preferences = {
        'school_weight': 15,
        'hospital_weight': 4,
        'supermarket_weight': 21
    }

    # Act
    score = calculate_location_score(location, preferences)

    # Assert
    assert isinstance(score, float)
    assert 0 <= score <= 100
```

### 2. Integration Tests

#### Frontend Integration Tests

```javascript
// LocationSearch.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import LocationSearch from './LocationSearch';

const server = setupServer(
  rest.get('/api/locations', (req, res, ctx) => {
    return res(
      ctx.json([
        { id: 1, name: 'Location 1', score: 85 },
        { id: 2, name: 'Location 2', score: 75 }
      ])
    );
  })
);

describe('LocationSearch', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('fetches and displays locations', async () => {
    render(<LocationSearch />);
    
    fireEvent.click(screen.getByText('Search'));
    
    await waitFor(() => {
      expect(screen.getByText('Location 1')).toBeInTheDocument();
      expect(screen.getByText('Location 2')).toBeInTheDocument();
    });
  });
});
```

#### Backend Integration Tests

```python
# test_api.py
import pytest
from app import create_app
from app.models import db

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

def test_analyze_location_endpoint(app):
    client = app.test_client()
    
    response = client.post('/api/analyze', json={
        'location': {
            'latitude': 51.5074,
            'longitude': -0.1278
        },
        'preferences': {
            'school_weight': 15,
            'hospital_weight': 4,
            'supermarket_weight': 21
        }
    })
    
    assert response.status_code == 200
    assert 'score' in response.json
```

### 3. End-to-End Tests

```javascript
// location-search.cy.js
describe('Location Search Flow', () => {
  it('completes a full location search', () => {
    cy.visit('/');
    
    // Enter search criteria
    cy.get('[data-testid="location-input"]')
      .type('London');
    
    cy.get('[data-testid="search-button"]')
      .click();
    
    // Wait for results
    cy.get('[data-testid="location-card"]')
      .should('have.length.at.least', 1);
    
    // Check score display
    cy.get('[data-testid="score"]')
      .should('be.visible');
    
    // Verify map interaction
    cy.get('[data-testid="map"]')
      .should('be.visible');
  });
});
```

## Test Coverage

### Frontend Coverage

```bash
# Generate coverage report
npm test -- --coverage

# Coverage thresholds in package.json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "statements": 80,
        "branches": 75,
        "functions": 80,
        "lines": 80
      }
    }
  }
}
```

### Backend Coverage

```bash
# Generate coverage report
pytest --cov=app tests/ --cov-report=html

# Coverage configuration in pytest.ini
[pytest]
addopts = --cov=app --cov-report=term-missing
```

## Testing Best Practices

### 1. Test Organization

```
project/
├── src/
│   ├── components/
│   │   ├── __tests__/
│   │   │   └── Component.test.jsx
│   │   └── Component.jsx
│   └── services/
│       ├── __tests__/
│       │   └── service.test.js
│       └── service.js
└── tests/
    ├── integration/
    └── e2e/
```

### 2. Naming Conventions

- Test files: `*.test.js` or `*.test.jsx`
- Test suites: `describe('ComponentName', () => {})`
- Test cases: `it('should do something specific', () => {})`

### 3. Test Data

```javascript
// test-utils.js
export const mockLocation = {
  id: 1,
  name: 'Test Location',
  score: 85,
  coordinates: { lat: 51.5074, lng: -0.1278 }
};

export const mockPreferences = {
  school_weight: 15,
  hospital_weight: 4,
  supermarket_weight: 21
};
```

### 4. Mocking

```javascript
// API mocking
jest.mock('../api', () => ({
  fetchLocations: jest.fn(() => Promise.resolve([
    { id: 1, name: 'Location 1' },
    { id: 2, name: 'Location 2' }
  ]))
}));

// Component mocking
jest.mock('../components/LocationCard', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-location-card" />
}));
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: Install dependencies
      run: npm install
      
    - name: Run tests
      run: npm test
      
    - name: Upload coverage
      uses: codecov/codecov-action@v2
```

## Performance Testing

### Frontend Performance

```javascript
// performance.test.js
import { render } from '@testing-library/react';
import { LocationList } from './LocationList';

describe('LocationList Performance', () => {
  it('renders 1000 locations within 1 second', () => {
    const locations = Array(1000).fill().map((_, i) => ({
      id: i,
      name: `Location ${i}`,
      score: Math.random() * 100
    }));
    
    const startTime = performance.now();
    render(<LocationList locations={locations} />);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(1000);
  });
});
```

### Backend Performance

```python
# test_performance.py
import pytest
import time
from app.services.scoring import calculate_location_score

def test_scoring_performance():
    start_time = time.time()
    
    # Calculate scores for 100 locations
    for _ in range(100):
        calculate_location_score({
            'latitude': 51.5074,
            'longitude': -0.1278
        }, {
            'school_weight': 15,
            'hospital_weight': 4,
            'supermarket_weight': 21
        })
    
    end_time = time.time()
    total_time = end_time - start_time
    
    assert total_time < 5.0  # Should complete within 5 seconds
```

## Support

For testing-related questions:
- Email: testing-support@locationscorer.com
- Documentation: https://docs.locationscorer.com/testing
- Issue Tracker: https://github.com/yourusername/location-score-analyzer/issues 