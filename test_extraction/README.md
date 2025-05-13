# PropertyFinder Test Suite

This directory contains the test suite for the PropertyFinder application, reconstructed from test documentation.

## Structure

- `source-code/server/tests/` - Backend tests (Python)
  - `unit/` - Unit tests for utility functions and scoring algorithms
  - `integration/` - Integration tests for APIs and external services
  - `performance/` - Performance tests using Locust

- `source-code/client/src/tests/` - Frontend tests (JavaScript/React)
  - Component tests for UI elements
  - Utility function tests

- `source-code/client/cypress/e2e/` - End-to-end tests using Cypress

## Running Tests

### Backend Tests

```bash
cd source-code/server
pytest
```

### Frontend Tests

```bash
cd source-code/client
npm test
```

### End-to-End Tests

```bash
cd source-code/client
npm run cypress:run
```

## Test Coverage

- Backend: 72% statement coverage
- Frontend: 88% statement coverage
