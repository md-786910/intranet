/**
 * Extracts validation errors from an API error response.
 * Expects the backend format: { errors: [{ field, message }, ...] }
 * @param {Error} err The error object from the API call
 * @returns {Object} An object mapping field names to their first error message
 */
export const extractValidationErrors = (err) => {
  const validationErrors = {};
  const errors = err.response?.data?.errors;

  if (Array.isArray(errors)) {
    errors.forEach((error) => {
      // If multiple errors for the same field, use the first one
      if (!validationErrors[error.field]) {
        validationErrors[error.field] = error.message;
      }
    });
  }

  return validationErrors;
};

/**
 * Gets a user-friendly error message from an API error response.
 * @param {Error} err The error object from the API call
 * @param {string} fallback The fallback message if no message is found
 * @returns {string} The error message
 */
export const getErrorMessage = (err, fallback = 'An unexpected error occurred') => {
  return err.response?.data?.message || err.message || fallback;
};
