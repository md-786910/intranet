import { useContext } from 'react';
import { OrganisationContext } from '../contexts/OrganisationContext';

export function useCurrentOrganisation() {
  const context = useContext(OrganisationContext);
  if (!context) {
    throw new Error('useCurrentOrganisation must be used within an OrganisationProvider');
  }
  return context;
}
