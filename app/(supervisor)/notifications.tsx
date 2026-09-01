/**
 * Supervisor's notification tray, nested under the `(supervisor)` group so the
 * root guard keeps `segments[0] === '(supervisor)'` and the group Stack
 * supplies the header + back button. Implementation is shared with Worker.
 */
export { NotificationsScreen as default } from '../../src/components/NotificationsScreen';
