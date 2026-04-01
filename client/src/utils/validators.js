export function isRequired(value) {
  if (value === null || value === undefined || value === '') return 'This field is required';
  return null;
}

export function isEmail(value) {
  if (!value) return null;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(value) ? null : 'Please enter a valid email address';
}

export function minLength(min) {
  return (value) => {
    if (!value) return null;
    return value.length >= min ? null : `Must be at least ${min} characters`;
  };
}

export function maxLength(max) {
  return (value) => {
    if (!value) return null;
    return value.length <= max ? null : `Must be at most ${max} characters`;
  };
}

export function isStrongPassword(value) {
  if (!value) return null;
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/;
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!re.test(value)) return 'Must include uppercase, lowercase, digit, and special character';
  return null;
}

export function validateForm(values, rules) {
  const errors = {};
  let isValid = true;

  Object.keys(rules).forEach((field) => {
    const fieldRules = rules[field];
    for (const rule of fieldRules) {
      const error = rule(values[field]);
      if (error) {
        errors[field] = error;
        isValid = false;
        break;
      }
    }
  });

  return { isValid, errors };
}
