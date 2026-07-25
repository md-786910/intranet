import React from 'react';
import { Navigate } from 'react-router-dom';

/** Analytics now lives on the main Dashboard — keep old URLs working. */
export default function AnalyticsPage() {
  return <Navigate to="/dashboard" replace />;
}
