/**
 * Re-export of the single app store (src/store/index.js). See ./authSlice.js —
 * there is one Provider at the root of App.js, so a second configureStore()
 * here would build a store nothing is subscribed to.
 */
export * from '../../../src/store';
