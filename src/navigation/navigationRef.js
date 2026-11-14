import { createNavigationContainerRef } from '@react-navigation/native';

// App-wide navigation handle for code outside screens (e.g. a tapped phone
// notification). Attached to the NavigationContainer in App.js.
export const navigationRef = createNavigationContainerRef();
