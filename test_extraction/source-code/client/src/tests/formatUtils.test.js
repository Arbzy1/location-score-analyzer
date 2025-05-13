import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';


import { formatMinutes, formatDistance, formatScoreAsStars, formatTransportMode } from '../utils/formatUtils';

describe('formatMinutes', () => {
  it('should format minutes correctly', () => {
    expect(formatMinutes(75)).toBe('1h 15m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(133)).toBe('2h 13m');
  });
  
  it('should handle edge cases', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(null)).toBe('-');
    expect(formatMinutes(undefined)).toBe('-');
  });
});

describe('formatDistance', () => {
  it('should format distances correctly', () => {
    expect(formatDistance(750)).toBe('750m');
    expect(formatDistance(1000)).toBe('1.0km');
    expect(formatDistance(1500)).toBe('1.5km');
  });
});

describe('formatScoreAsStars', () => {
  it('should convert scores to stars', () => {
    expect(formatScoreAsStars(90)).toBe('★★★★★');
    expect(formatScoreAsStars(70)).toBe('★★★★☆');
    expect(formatScoreAsStars(50)).toBe('★★★☆☆');
  });
});
