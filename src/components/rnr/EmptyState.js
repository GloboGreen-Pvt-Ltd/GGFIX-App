import React from 'react';
import { Text, View } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { cn } from './cn';
import { Button } from './Button';
import { tokens } from '../../theme/colors';
import { rf } from '../../utils/responsive';

export function EmptyState({
  icon,
  title = 'Nothing here yet',
  description,
  actionLabel,
  onAction,
  className,
  accent,      // optional: default icon + action button colour
  accentSoft,  // optional: icon circle background
}) {
  return (
    <View className={cn('items-center justify-center px-8 py-14', className)}>
      <View className="h-24 w-24 rounded-full bg-primary-soft items-center justify-center mb-5" style={accentSoft ? { backgroundColor: accentSoft } : null}>
        {icon || <Inbox size={40} color={accent || tokens.primary} />}
      </View>
      <Text className="font-extrabold text-text text-center" style={{ fontSize: rf(17) }}>{title}</Text>
      {description ? (
        <Text className="text-text-muted text-center mt-1.5 leading-5" style={{ fontSize: rf(13) }}>{description}</Text>
      ) : null}
      {actionLabel ? (
        <Button onPress={onAction} className="mt-6 px-7" style={accent ? { backgroundColor: accent, shadowColor: accent } : undefined}>{actionLabel}</Button>
      ) : null}
    </View>
  );
}
