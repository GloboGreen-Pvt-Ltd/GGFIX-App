import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';

const GREEN_TEXT = '#078F23';
const MINT = '#EAF8EC';
const LINE = '#E6E6E6';

// Type-in dialog for a brand / model the catalogue doesn't carry ("Other").
// Repair booking only — the typed name rides along on that booking and is
// never written to master data.
export default function OtherNameDialog({
  visible, title, description, label, placeholder, value, onChangeText, onCancel, onSubmit,
}) {
  const [focused, setFocused] = useState(false);
  const ok = !!(value || '').trim();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable
          onPress={onCancel}
          style={{ flex: 1, backgroundColor: 'rgba(30,30,30,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={{ width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: LINE }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ height: 32, width: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: MINT, marginRight: 9 }}>
                <Plus size={16} color={GREEN_TEXT} />
              </View>
              <Text style={{ flex: 1, fontSize: rf(14.5), fontWeight: '800', color: BRAND.ink }}>{title}</Text>
              <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Close" className="active:opacity-70">
                <X size={18} color={BRAND.muted} />
              </Pressable>
            </View>
            {description ? (
              <Text style={{ marginTop: 8, fontSize: rf(11.5), lineHeight: rf(16.5), color: BRAND.muted }}>{description}</Text>
            ) : null}
            {label ? (
              <Text style={{ marginTop: 11, marginBottom: 5, fontSize: rf(10), fontWeight: '800', letterSpacing: 0.8, color: BRAND.ink }}>{label}</Text>
            ) : null}
            <TextInput
              autoFocus
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={BRAND.muted}
              returnKeyType="done"
              onSubmitEditing={() => { if (ok) onSubmit(); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel={label || title}
              style={[
                {
                  marginTop: label ? 0 : 11, height: 44, paddingHorizontal: 12, borderRadius: 12, fontSize: rf(13.5), color: BRAND.ink,
                  backgroundColor: BRAND.line, borderWidth: 1, borderColor: focused ? BRAND.green : LINE,
                },
                // Web only: drop the browser focus ring inside the rounded field.
                Platform.OS === 'web' ? { outlineStyle: 'none' } : null,
              ]}
            />
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                className="active:opacity-70"
                style={{ flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: LINE, marginRight: 8 }}
              >
                <Text style={{ fontSize: rf(13), fontWeight: '700', color: BRAND.ink }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onSubmit}
                disabled={!ok}
                accessibilityRole="button"
                className="active:opacity-80"
                accessibilityState={{ disabled: !ok }}
                style={{ flex: 1, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.green, opacity: ok ? 1 : 0.45 }}
              >
                <Text style={{ fontSize: rf(13), fontWeight: '800', color: '#FFFFFF' }}>Continue</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
