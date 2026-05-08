import React from 'react';

export default function MaterialIcon({ name, className = '', ...rest }) {
  return (
    <span className={`material-symbols-outlined ${className}`} {...rest}>
      {name}
    </span>
  );
}
