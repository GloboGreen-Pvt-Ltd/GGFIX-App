import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../../theme/colors';
import { Card, Empty, Loader } from '../../../components/ui';
import { getFaqItems } from '../../../api/masterData';
import { rf, rlh } from '../../../utils/responsive';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  q: { fontSize: rf(14), fontWeight: '700', color: colors.text, flex: 1 },
  a: { fontSize: rf(13), color: colors.textSecondary, marginTop: 8, lineHeight: rlh(20) },
});

export default function FaqScreen() {
  const [items, setItems] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setItems(await getFaqItems()); } catch (_) {}
      setLoading(false);
    })();
  }, []);
  if (loading) return <Loader />;
  if (!items.length) return <Empty text="No FAQs published yet" />;
  return (
    <ScrollView style={styles.container}>
      {items.map((it) => (
        <Card key={it.id}>
          <TouchableOpacity onPress={() => setOpenId(openId === it.id ? null : it.id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.q}>{it.question}</Text>
            <Ionicons name={openId === it.id ? 'chevron-up' : 'chevron-down'} color={colors.textSecondary} size={18} />
          </TouchableOpacity>
          {openId === it.id ? <Text style={styles.a}>{it.answer}</Text> : null}
        </Card>
      ))}
    </ScrollView>
  );
}
