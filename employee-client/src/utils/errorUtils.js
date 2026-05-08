export const extractValidationErrors = (err) => {
  const validationErrors = {};
  const errors = err.response?.data?.errors;

  if (Array.isArray(errors)) {
    errors.forEach((error) => {
      if (!validationErrors[error.field]) {
        validationErrors[error.field] = error.message;
      }
    });
  }

  return validationErrors;
};

export const getErrorMessage = (err, fallback = 'An unexpected error occurred') => {
  return err.response?.data?.message || err.message || fallback;
};
