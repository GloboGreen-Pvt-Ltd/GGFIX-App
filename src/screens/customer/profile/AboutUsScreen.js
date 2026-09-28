import React, { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import colors from '../../../theme/colors';
import { Loader } from '../../../components/ui';
import { getAppContent } from '../../../api/masterData';
import { rf, rlh } from '../../../utils/responsive';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  title: { fontSize: rf(22), fontWeight: '700', color: colors.text, marginBottom: 12 },
  body: { fontSize: rf(14), color: colors.text, lineHeight: rlh(22) },
});

export default function AboutUsScreen() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setContent(await getAppContent('ABOUT_US')); } catch (_) {}
      setLoading(false);
    })();
  }, []);
  if (loading) return <Loader />;
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{content?.title || 'About Us'}</Text>
      <Text style={styles.body}>{content?.body || 'Globo Green helps you repair, buy and sell mobile devices through a network of trusted nearby shops.'}</Text>
    </ScrollView>
  );
}
