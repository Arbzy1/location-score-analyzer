import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';
import ErrorMessage from '../components/ErrorMessage';

// Component that throws an error
const ProblemComponent = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary Component', () => {
  // Suppress console errors for the test
  const originalError = console.error;
  beforeEach(() => {
    console.error = jest.fn();
  });
  
  afterEach(() => {
    console.error = originalError;
  });
  
  it('renders fallback UI when child throws an error', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="error-fallback">Something went wrong</div>}>
        <ProblemComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
  
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        <div data-testid="normal-content">Everything is fine</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('normal-content')).toBeInTheDocument();
    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
  });
});

describe('ErrorMessage Component', () => {
  it('renders error message with correct styling', () => {
    render(<ErrorMessage message="API request failed" />);
    
    expect(screen.getByText('API request failed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('error-message');
  });
  
  it('renders null when no message is provided', () => {
    const { container } = render(<ErrorMessage message="" />);
    expect(container.firstChild).toBeNull();
  });
  
  it('calls onDismiss when close button is clicked', () => {
    const handleDismiss = jest.fn();
    render(<ErrorMessage message="Error occurred" onDismiss={handleDismiss} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
}); 