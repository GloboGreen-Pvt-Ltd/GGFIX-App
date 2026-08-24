import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { cn } from './cn';
import { rf } from '../../utils/responsive';

export function Chip({ label, active = false, onPress, leftIcon, rightIcon, variant = 'default', size = 'md', className, textClassName }) {
  const Wrapper = onPress ? Pressable : View;
  const sizing = size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2';
  const textFontSize = size === 'sm' ? 11 : 12.5;

  const palettes = {
    default: {
      idle: 'bg-card border-border',
      active: 'bg-primary border-primary',
      textIdle: 'text-text',
      textActive: 'text-white',
    },
    accent: {
      idle: 'bg-card border-border',
      active: 'bg-accent border-accent',
      textIdle: 'text-text',
      textActive: 'text-white',
    },
    soft: {
      idle: 'bg-surface-muted border-transparent',
      active: 'bg-primary-soft border-primary',
      textIdle: 'text-text-muted',
      textActive: 'text-primary-dark',
    },
  };
  const p = palettes[variant] || palettes.default;

  return (
    <Wrapper
      onPress={onPress}
      className={cn(
        'flex-row items-center rounded-full border mr-2 mb-2',
        sizing,
        active ? p.active : p.idle,
        className,
      )}
    >
      {leftIcon ? <View className="mr-1.5">{leftIcon}</View> : null}
      <Text className={cn('font-semibold', active ? p.textActive : p.textIdle, textClassName)} style={{ fontSize: rf(textFontSize) }}>{label}</Text>
      {rightIcon ? <View className="ml-1.5">{rightIcon}</View> : null}
    </Wrapper>
  );
}
