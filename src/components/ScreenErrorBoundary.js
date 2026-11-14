import React from 'react';
import { Pressable, Text, View } from 'react-native';

// Keeps a screen open when it throws while rendering: shows the real error
// message with Retry (instead of the screen closing), and logs it to Metro.
export default class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error(`[${this.props.name || 'Screen'}] render error:`, error?.message, info?.componentStack);
  }

  render() {
    const { error, attempt } = this.state;
    if (error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#111111' }}>Couldn't show this order</Text>
          <Text style={{ fontSize: 13, color: '#606E87', marginTop: 6, textAlign: 'center' }}>{String(error?.message || error)}</Text>
          <Pressable
            onPress={() => this.setState({ error: null, attempt: attempt + 1 })}
            accessibilityRole="button"
            style={{ marginTop: 14, height: 44, paddingHorizontal: 28, borderRadius: 12, backgroundColor: '#035C6C', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
  }
}

export const withScreenErrorBoundary = (Comp, name) => {
  const Wrapped = (props) => (
    <ScreenErrorBoundary name={name}>
      <Comp {...props} />
    </ScreenErrorBoundary>
  );
  Wrapped.displayName = `WithBoundary(${name})`;
  return Wrapped;
};
