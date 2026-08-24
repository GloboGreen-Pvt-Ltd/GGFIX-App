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

export default function TermsScreen() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setContent(await getAppContent('TERMS')); } catch (_) {}
      setLoading(false);
    })();
  }, []);
  if (loading) return <Loader />;
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{content?.title || 'Terms & Conditions'}</Text>
      <Text style={styles.body}>{content?.body || 'By using this app you agree to our terms. Content can be managed by admin.'}</Text>
    </ScrollView>
  );
}
