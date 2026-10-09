// Jump from any stack screen back to the bottom tabs and switch to one tab.
// The tabs live inside the "CustomerTabs" stack route, so a stack screen
// can't navigate('Buy') directly (React Navigation warns "not handled").
// { pop: true } goes BACK to the existing tabs route (never pushes a second
// copy) and applies the new params, which switches the nested tab.
export function goToTab(navigation, tab) {
  navigation.navigate('CustomerTabs', { screen: tab }, { pop: true });
}
