import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TravelPreferences from '../components/TravelPreferences';

describe('TravelPreferences Component', () => {
  const mockPreferences = {
    workAddress: '10 Downing Street, London',
    workDays: 5,
    transportMode: 'transit',
    maxTravelTime: 45,
    includeWeekends: false
  };
  
  const mockOnChange = jest.fn();
  
  it('renders all travel preference form fields', () => {
    render(<TravelPreferences preferences={mockPreferences} onChange={mockOnChange} />);
    
    expect(screen.getByLabelText(/work address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work days/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/transport mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/maximum travel time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/include weekends/i)).toBeInTheDocument();
  });
  
  it('calls onChange when preferences change', () => {
    render(<TravelPreferences preferences={mockPreferences} onChange={mockOnChange} />);
    
    // Change work address
    const addressInput = screen.getByLabelText(/work address/i);
    fireEvent.change(addressInput, { target: { value: 'Cardiff Castle, UK' } });
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockPreferences,
      workAddress: 'Cardiff Castle, UK'
    });
    
    // Change transport mode
    const transportSelect = screen.getByLabelText(/transport mode/i);
    fireEvent.change(transportSelect, { target: { value: 'driving' } });
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockPreferences,
      transportMode: 'driving'
    });
    
    // Toggle weekend preference
    const weekendCheckbox = screen.getByLabelText(/include weekends/i);
    fireEvent.click(weekendCheckbox);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      ...mockPreferences,
      includeWeekends: true
    });
  });
  
  it('validates work address input', () => {
    render(<TravelPreferences preferences={mockPreferences} onChange={mockOnChange} />);
    
    const addressInput = screen.getByLabelText(/work address/i);
    fireEvent.change(addressInput, { target: { value: '' } });
    fireEvent.blur(addressInput);
    
    expect(screen.getByText(/address is required/i)).toBeInTheDocument();
  });
  
  it('validates max travel time is within reasonable range', () => {
    render(<TravelPreferences preferences={mockPreferences} onChange={mockOnChange} />);
    
    const timeInput = screen.getByLabelText(/maximum travel time/i);
    fireEvent.change(timeInput, { target: { value: '120' } });
    fireEvent.blur(timeInput);
    
    expect(screen.getByText(/travel time should be between 5 and 90 minutes/i)).toBeInTheDocument();
  });
}); 