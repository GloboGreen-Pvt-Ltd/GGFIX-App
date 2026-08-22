/**
 * Re-export of the app-wide auth slice at src/store/authSlice.js.
 *
 * The shop (owner + in-shop technician) shell used to declare its own slice, but RTK derives
 * action types from the slice NAME — and all three shells named theirs 'auth'.
 * Two live slices would mean `dispatch(setSession(...))` from a screen here
 * hitting a reducer that isn't the one in the Provider's store, so this shell's
 * extra fields would never be written. One slice, imported from everywhere.
 *
 * Every import in this subtree ('../store/authSlice', '../../store/authSlice', …)
 * keeps working unchanged.
 */
export * from '../../../src/store/authSlice';
export { default } from '../../../src/store/authSlice';
