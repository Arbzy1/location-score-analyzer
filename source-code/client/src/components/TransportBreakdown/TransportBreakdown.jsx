import React, { useState } from 'react';
import './TransportBreakdown.css';

export const TransportBreakdown = ({ transport_modes, travel_details }) => {
  const [expanded, setExpanded] = useState(false);

  if (!transport_modes || Object.keys(transport_modes).length === 0) {
    return null;
  }

  const formatTime = (minutes) => {
    if (minutes === undefined || minutes === null) return 'N/A';
    
    if (minutes < 60) {
      return `${Math.round(minutes)} mins`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}m`;
    }
  };

  const getTransportModeIcon = (mode) => {
    switch (mode) {
      case 'driving-car': return '🚗';
      case 'cycling-regular': return '🚴';
      case 'foot-walking': return '🚶';
      case 'bus-transit': return '🚌';
      default: return '🚗';
    }
  };

  const getRelativePerformance = (time, bestTime) => {
    if (time === bestTime) return 'best';
    
    const percentSlower = ((time - bestTime) / bestTime) * 100;
    
    if (percentSlower <= 20) return 'good';
    if (percentSlower <= 50) return 'moderate';
    return 'slow';
  };

  const getModeName = (mode) => {
    switch (mode) {
      case 'driving-car': 
      case 'driving': 
        return 'Driving';
      case 'cycling-regular': 
      case 'cycling': 
        return 'Cycling';
      case 'foot-walking': 
      case 'walking': 
        return 'Walking';
      case 'bus-transit': 
      case 'bus': 
        return 'Bus';
      default: 
        return mode;
    }
  };

  return (
    <div className="transport-breakdown">
      <div className="transport-breakdown-header" onClick={() => setExpanded(!expanded)}>
        <h4>Transport Mode Comparison</h4>
        <span className="toggle-icon">{expanded ? '▲' : '▼'}</span>
      </div>
      
      {expanded && (
        <div className="transport-details">
          <p className="transport-explanation">
            Compare travel times across all transport modes for each destination
            {travel_details?.mode_preference && (
              <span className="mode-preference"> (Preference: {getModeName(travel_details.mode_preference)})</span>
            )}
          </p>
          
          {Object.entries(transport_modes).map(([key, data]) => {
            const alternativeModes = data.alternative_modes || {};
            if (Object.keys(alternativeModes).length === 0) return null;
            
            // Find the fastest time
            const times = Object.values(alternativeModes);
            const bestTime = Math.min(...times);
            
            return (
              <div key={key} className="destination-breakdown">
                <h5>{key}</h5>
                <div className="mode-comparison">
                  {Object.entries(alternativeModes).map(([mode, time]) => {
                    const performance = getRelativePerformance(time, bestTime);
                    
                    return (
                      <div key={mode} className={`mode-time ${performance} ${mode === data.selected_mode ? 'selected' : ''}`}>
                        <div className="mode-icon">{getTransportModeIcon(mode)}</div>
                        <div className="mode-details">
                          <span className="mode-name">{getModeName(mode)}</span>
                          <span className="time">{formatTime(time)}</span>
                        </div>
                        {/* Show the checkmark for the mode that was actually used in calculations */}
                        {(mode === data.selected_mode || 
                          // If global preference is set, show checkmark on that mode regardless of what data.selected_mode says
                          (travel_details?.mode_preference && travel_details.mode_preference !== 'auto' && 
                           // Handle different formats of the same mode (e.g., 'bus' vs 'bus-transit')
                           ((travel_details.mode_preference === 'bus' && mode === 'bus-transit') ||
                            (travel_details.mode_preference === 'driving' && mode === 'driving-car') ||
                            (travel_details.mode_preference === 'walking' && mode === 'foot-walking') ||
                            (travel_details.mode_preference === 'cycling' && mode === 'cycling-regular') ||
                            mode === travel_details.mode_preference))) && (
                          <div className="selected-badge">✓</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          <div className="transport-legend">
            <div className="legend-item best">Best time</div>
            <div className="legend-item good">Up to 20% slower</div>
            <div className="legend-item moderate">20-50% slower</div>
            <div className="legend-item slow">50%+ slower</div>
            <div className="legend-item selected">Selected mode</div>
          </div>
        </div>
      )}
    </div>
  );
}; 