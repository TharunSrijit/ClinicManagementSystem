import React from 'react';
import { getStatusBadgeVariant } from '../utils/formatters';

export const Badge = ({ children, variant, status }) => {
  const actualVariant = variant || (status ? getStatusBadgeVariant(status) : 'info');
  return (
    <span className={`badge badge-${actualVariant}`}>
      {children || status}
    </span>
  );
};

export default Badge;
