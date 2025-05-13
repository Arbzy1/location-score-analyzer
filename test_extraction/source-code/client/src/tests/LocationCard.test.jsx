import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';


import LocationCard from '../components/LocationCard';

const mockLocation = {
  lat: 51.481,
  lon: -3.179,
  score: 85,
  area_name: 'Cardiff Bay',
  amenities: {
    school: { name: 'Cardiff School', distance: 500 },
    hospital: { name: 'Heath Hospital', distance: 1200 }
  }
};

describe('LocationCard', () => {
  it('renders location information correctly', () => {
    const { getByText } = render(<LocationCard location={mockLocation} />);
    expect(getByText('Cardiff Bay')).toBeInTheDocument();
    expect(getByText('85')).toBeInTheDocument();
    expect(getByText('Cardiff School')).toBeInTheDocument();
  });
  
  it('calls onSelectStart when start button is clicked', () => {
    const mockOnSelectStart = jest.fn();
    const { getByTestId } = render(
      <LocationCard 
        location={mockLocation} 
        onSelectStart={mockOnSelectStart} 
      />
    );
    
    fireEvent.click(getByTestId('set-start-btn'));
    expect(mockOnSelectStart).toHaveBeenCalledWith(mockLocation);
  });
});
