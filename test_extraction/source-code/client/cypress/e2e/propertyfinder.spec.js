import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';


describe('PropertyFinder Application', () => {
  it('should load the homepage', () => {
    cy.visit('/');
    cy.get('[data-testid=app-title]').should('be.visible');
  });
  
  it('should allow searching by postcode', () => {
    cy.visit('/');
    cy.get('[data-testid=postcode-input]').type('CF10 3NB');
    cy.get('[data-testid=search-button]').click();
    cy.get('[data-testid=results-list]').should('be.visible');
  });
  
  it('should display property cards for results', () => {
    cy.get('[data-testid=location-card]').should('have.length.at.least', 1);
  });
  
  it('should handle error states gracefully', () => {
    cy.visit('/');
    cy.get('[data-testid=postcode-input]').type('INVALID');
    cy.get('[data-testid=search-button]').click();
    cy.get('[data-testid=error-message]').should('be.visible');
  });
});
