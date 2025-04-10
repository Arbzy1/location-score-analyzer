# API Documentation

## Overview

Location Score Analyzer provides a RESTful API for location analysis and scoring. This document outlines the available endpoints, request/response formats, and authentication requirements.

## Base URL

```
https://api.locationscorer.com/v1
```

## Authentication

All API requests require authentication using an API key. Include your API key in the request header:

```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Analyze Location

```http
POST /analyze
```

Analyzes a location and returns a comprehensive score based on travel times, amenities, and public transport accessibility.

#### Request Body

```json
{
  "location": {
    "latitude": 51.5074,
    "longitude": -0.1278
  },
  "destinations": [
    {
      "type": "work",
      "latitude": 51.5174,
      "longitude": -0.1378,
      "frequency": 5
    },
    {
      "type": "school",
      "latitude": 51.4974,
      "longitude": -0.1178,
      "frequency": 5
    }
  ],
  "preferences": {
    "school_weight": 15,
    "hospital_weight": 4,
    "supermarket_weight": 21
  }
}
```

#### Response

```json
{
  "score": 67.2,
  "breakdown": {
    "travel": {
      "score": 33.82,
      "max_score": 40,
      "details": {
        "average_daily_time": 52,
        "weekly_total": 260
      }
    },
    "amenities": {
      "score": 28,
      "max_score": 40,
      "details": {
        "school": {
          "score": 10.4,
          "distance": 617,
          "name": "Ninian Park Primary School"
        },
        "hospital": {
          "score": 1.7,
          "distance": 1711,
          "name": "Saint David's Hospital"
        },
        "supermarket": {
          "score": 5.2,
          "distance": 753,
          "name": "Lidl"
        }
      }
    },
    "transit": {
      "score": 5,
      "max_score": 20,
      "details": {
        "routes": 5,
        "nearest_stop_distance": 150
      }
    }
  }
}
```

### Get Location Details

```http
GET /locations/{id}
```

Retrieves detailed information about a previously analyzed location.

#### Response

```json
{
  "id": "loc_123",
  "coordinates": {
    "latitude": 51.5074,
    "longitude": -0.1278
  },
  "area_name": "The Colonies",
  "score": 67.2,
  "breakdown": {
    // Same as analyze endpoint response
  },
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### Search Locations

```http
GET /locations/search
```

Searches for locations based on various criteria.

#### Query Parameters

- `min_score` (number): Minimum score threshold
- `max_distance` (number): Maximum distance from reference point
- `amenity_type` (string): Filter by amenity type
- `limit` (number): Maximum number of results
- `offset` (number): Pagination offset

#### Response

```json
{
  "results": [
    {
      "id": "loc_123",
      "area_name": "The Colonies",
      "score": 67.2,
      "coordinates": {
        "latitude": 51.5074,
        "longitude": -0.1278
      }
    }
  ],
  "total": 100,
  "limit": 10,
  "offset": 0
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error details if available
    }
  }
}
```

### Common Error Codes

- `INVALID_REQUEST`: The request was invalid
- `UNAUTHORIZED`: Authentication failed
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API requests are limited to:
- 100 requests per minute for standard API keys
- 1000 requests per minute for premium API keys

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1523456789
```

## Versioning

The API version is included in the URL path. The current version is v1.

## Support

For API support, please contact:
- Email: api-support@locationscorer.com
- Documentation: https://docs.locationscorer.com
- Status Page: https://status.locationscorer.com 