import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { cn } from './cn';
import { tokens } from '../../theme/colors';
import { rf } from '../../utils/responsive';

export function SectionHeader({ title, action, onAction, className, caption }) {
  return (
    <View className={cn('flex-row items-end justify-between px-4 mt-4 mb-2', className)}>
      <View className="flex-1 pr-3">
        <Text className="font-extrabold text-text" style={{ fontSize: rf(15) }}>{title}</Text>
        {caption ? (
          <Text className="text-text-muted mt-0.5" style={{ fontSize: rf(11) }}>{caption}</Text>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} className="flex-row items-center active:opacity-70">
          <Text className="font-bold text-primary" style={{ fontSize: rf(12) }}>{action}</Text>
          <ChevronRight size={14} color={tokens.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Alias for the name in the user's spec.
export const SectionTitle = SectionHeader;
