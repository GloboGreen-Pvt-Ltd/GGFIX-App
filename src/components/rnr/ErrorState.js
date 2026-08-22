import React from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { cn } from './cn';
import { Button } from './Button';
import { tokens } from '../../theme/colors';
import { rf } from '../../utils/responsive';

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
}) {
  return (
    <View className={cn('items-center justify-center px-8 py-14', className)}>
      <View className="h-24 w-24 rounded-full bg-danger/10 items-center justify-center mb-5">
        <AlertTriangle size={40} color={tokens.danger} />
      </View>
      <Text className="font-extrabold text-text text-center" style={{ fontSize: rf(17) }}>{title}</Text>
      {description ? (
        <Text className="text-text-muted text-center mt-1.5 leading-5" style={{ fontSize: rf(13) }}>{description}</Text>
      ) : null}
      {onRetry ? (
        <Button onPress={onRetry} variant="outline" className="mt-6 px-7" leftIcon={<RefreshCw size={16} color={tokens.primary} />}>
          {retryLabel}
        </Button>
      ) : null}
    </View>
  );
}
