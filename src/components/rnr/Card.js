import React from 'react';
import { View, Text } from 'react-native';
import { cn } from './cn';
import { shadows } from '../../theme/colors';
import { rf } from '../../utils/responsive';

export function Card({ className, children, padded = true, elevated = true, style, ...rest }) {
  return (
    <View
      {...rest}
      className={cn(
        'bg-card border border-border',
        padded && 'p-4',
        className,
      )}
      style={[{ borderRadius: 18 }, elevated && shadows.card, style]}
    >
      {children}
    </View>
  );
}

export function CardHeader({ className, children }) {
  return <View className={cn('mb-2', className)}>{children}</View>;
}

export function CardTitle({ className, children }) {
  return <Text className={cn('font-extrabold text-text', className)} style={{ fontSize: rf(15) }}>{children}</Text>;
}

export function CardDescription({ className, children }) {
  return <Text className={cn('text-text-muted mt-0.5', className)} style={{ fontSize: rf(12) }}>{children}</Text>;
}

export function CardDivider({ className }) {
  return <View className={cn('h-px bg-border my-3', className)} />;
}
