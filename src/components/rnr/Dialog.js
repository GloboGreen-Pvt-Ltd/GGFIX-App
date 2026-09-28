import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from './cn';
import { rf } from '../../utils/responsive';

export function Dialog({ open, onClose, children, className }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-center px-6" onPress={onClose}>
        <Pressable className={cn('bg-card rounded-2xl p-6', className)} onPress={(e) => e.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DialogHeader({ title, onClose }) {
  return (
    <View className="flex-row items-start justify-between mb-4">
      {title ? <Text className="font-bold text-text flex-1" style={{ fontSize: rf(18) }}>{title}</Text> : <View className="flex-1" />}
      {onClose ? (
        <Pressable onPress={onClose} className="p-1">
          <Ionicons name="close" size={22} color="#0F172A" />
        </Pressable>
      ) : null}
    </View>
  );
}
