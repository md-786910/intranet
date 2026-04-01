import React from 'react';
import Badge from './Badge';
import { STATUS_VARIANTS } from '../../utils/constants';

export default function StatusBadge({ status }) {
  if (!status) return null;
  const variant = STATUS_VARIANTS[status] || 'default';
  return <Badge variant={variant}>{status}</Badge>;
}
