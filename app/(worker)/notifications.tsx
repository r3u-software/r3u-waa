/**
 * Worker's notification tray, nested under the `(worker)` group so the root
 * guard keeps `segments[0] === '(worker)'` and the group Stack supplies the
 * header + back button. Implementation is shared with Supervisor.
 */
export { NotificationsScreen as default } from '../../src/components/NotificationsScreen';
