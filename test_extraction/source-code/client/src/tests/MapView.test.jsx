import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';


import MapView from '../components/MapView';

describe('MapView', () => {
  it('renders map container and markers', () => {
    const locations = [
      { lat: 51.481, lon: -3.179, score: 85 },
      { lat: 51.465, lon: -3.165, score: 78 }
    ];
    
    const { getByTestId } = render(<MapView locations={locations} />);
    expect(getByTestId('map-container')).toBeInTheDocument();
    // Mapbox markers would be tested in an integration test
  });
  
  it('calls onLocationSelect when a marker is clicked', () => {
    // Implementation would check if onLocationSelect callback is triggered
  });
});
