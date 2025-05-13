import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LocationFilter from '../components/LocationFilter';

describe('LocationFilter Component', () => {
  const mockFilters = {
    maxPrice: 300000,
    minBedrooms: 2,
    amenities: ['school', 'supermarket'],
    maxTravelTime: 30
  };
  
  const mockOnChange = jest.fn();
  
  it('renders all filter inputs correctly', () => {
    render(<LocationFilter filters={mockFilters} onChange={mockOnChange} />);
    
    expect(screen.getByLabelText(/price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bedrooms/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/travel time/i)).toBeInTheDocument();
    
    // Check amenity checkboxes
    expect(screen.getByLabelText(/school/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/supermarket/i)).toBeInTheDocument();
  });
  
  it('calls onChange when filter values change', () => {
    render(<LocationFilter filters={mockFilters} onChange={mockOnChange} />);
    
    // Change price filter
    const priceInput = screen.getByLabelText(/price/i);
    fireEvent.change(priceInput, { target: { value: '400000' } });
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockFilters,
      maxPrice: 400000
    });
    
    // Toggle an amenity
    const schoolCheckbox = screen.getByLabelText(/school/i);
    fireEvent.click(schoolCheckbox);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockFilters,
      amenities: ['supermarket']
    });
  });
  
  it('resets filters when reset button is clicked', () => {
    render(<LocationFilter filters={mockFilters} onChange={mockOnChange} />);
    
    const resetButton = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      maxPrice: 500000, // Default values
      minBedrooms: 1,
      amenities: [],
      maxTravelTime: 45
    });
  });
}); 