/**
 * Non-React toast bridge so axios interceptors can surface messages.
 * ToastProvider registers handlers on mount.
 */

let handler = null;

export const toastBridge = {
  register(fn) {
    handler = typeof fn === 'function' ? fn : null;
  },
  unregister() {
    handler = null;
  },
  /**
   * @param {string} message
   * @param {'error'|'success'|'warning'|'info'|'default'} [type]
   * @param {number} [duration]
   */
  show(message, type = 'error', duration) {
    if (!handler || !message) return;
    handler(message, type, duration);
  },
  error(message, duration) {
    this.show(message, 'error', duration);
  },
  success(message, duration) {
    this.show(message, 'success', duration);
  },
  warning(message, duration) {
    this.show(message, 'warning', duration);
  },
};
