// App-wide 'react-native' shim (wired in metro.config.js for files under src/).
// Re-exports everything unchanged, except vertical ScrollView / FlatList /
// SectionList, which get a pull-to-refresh from ScreenRefreshContext when a
// screen provides one — and only if the list has no refresh control of its own.
import React, { createContext, forwardRef, useContext } from 'react';
import * as RN from 'react-native';

export * from 'react-native';

export const ScreenRefreshContext = createContext(null);

function withScreenRefresh(Comp, name) {
  const Wrapped = forwardRef((props, ref) => {
    const ctx = useContext(ScreenRefreshContext);
    const own = props.refreshControl || props.onRefresh || props.horizontal;
    const inner = <Comp ref={ref} {...props} />;
    if (!ctx || own) {
      // Nested lists never get a second refresh control.
      return ctx ? <ScreenRefreshContext.Provider value={null}>{inner}</ScreenRefreshContext.Provider> : inner;
    }
    return (
      <ScreenRefreshContext.Provider value={null}>
        <Comp
          ref={ref}
          {...props}
          refreshControl={(
            <RN.RefreshControl refreshing={ctx.refreshing} onRefresh={ctx.onRefresh} colors={['#035C6C']} tintColor="#035C6C" />
          )}
        />
      </ScreenRefreshContext.Provider>
    );
  });
  Wrapped.displayName = name;
  return Wrapped;
}

export const ScrollView = withScreenRefresh(RN.ScrollView, 'ScrollView');
export const FlatList = withScreenRefresh(RN.FlatList, 'FlatList');
export const SectionList = withScreenRefresh(RN.SectionList, 'SectionList');
