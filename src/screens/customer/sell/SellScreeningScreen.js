import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, PrimaryButton, Loader } from '../../../components/ui';
import { getScreeningQuestions } from '../../../api/masterData';
import { rf } from '../../../utils/responsive';
import { BRAND } from '../../../theme/brand';
import { cardShadow } from '../service-booking-customer/FlowChrome';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  card: { padding: 11, marginVertical: 4, borderRadius: 14, backgroundColor: BRAND.card, borderWidth: 1, borderColor: '#E6E6E6', ...cardShadow },
  qTitle: { fontSize: rf(12.5), fontWeight: '700', color: BRAND.ink },
  qHelp: { fontSize: rf(10.5), color: BRAND.muted, marginTop: 1 },
  ansRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 9, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, marginTop: 6, backgroundColor: BRAND.bg },
  ansRowActive: { borderColor: BRAND.green, backgroundColor: BRAND.greenSoft },
  ansLabel: { marginLeft: 7, fontSize: rf(12.5), color: BRAND.ink, flexShrink: 1 },
  editBanner: { backgroundColor: BRAND.yellowSoft, borderColor: BRAND.yellowLine, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 4, flexDirection: 'row', alignItems: 'center' },
  editBannerTitle: { fontSize: rf(10), fontWeight: '800', color: BRAND.ink, letterSpacing: 0.5 },
  editBannerText: { fontSize: rf(12), color: BRAND.ink, fontWeight: '600', marginTop: 2 },
  bottom: { padding: 10, backgroundColor: '#fff', borderTopColor: BRAND.line, borderTopWidth: 1 },
});

export default function SellScreeningScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const params = route.params || {};
  const { device, workingCondition, editSellOrderId, editHints } = params;
  const flow = workingCondition === 'DEAD' ? 'DEAD' : 'WORKING';
  const isEditing = !!editSellOrderId;
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  // Look up prior answers by questionId so we can pre-select on first render.
  const priorByQuestionId = useMemo(() => {
    const m = {};
    (editHints?.screeningAnswers || []).forEach((a) => {
      if (a?.questionId && a?.answer) m[a.questionId] = a.answer;
    });
    return m;
  }, [editHints]);

  useEffect(() => {
    (async () => {
      try {
        const list = await getScreeningQuestions(flow, device?.categoryId);
        const fallback = flow === 'DEAD' ? [
          { id: 'd1', question: 'What is the current condition of your phone?', helperText: '', options: ['Phone Dead (Not powering on)', 'Unknown Condition (Not sure / partially working)'] },
          { id: 'd2', question: "Is your phone's display original?", helperText: 'Choose Yes if never changed.', options: ['Yes', 'No'] },
        ] : [
          { id: 'w1', question: 'Is your phone working properly?', helperText: 'Check your phone powers on.', options: ['Yes', 'No'] },
          { id: 'w2', question: 'Is your touchscreen working properly?', helperText: 'Check touch functionality.', options: ['Yes', 'No'] },
          { id: 'w3', question: "Is your phone's display original?", helperText: 'Choose Yes if never changed.', options: ['Yes', 'No'] },
          { id: 'w4', question: 'Is your phone have a valid warranty?', helperText: '', options: ['Yes', 'No'] },
        ];
        const finalList = list.length ? list : fallback;
        setQuestions(finalList);

        // Seed prior answers once the question list is known. Match by id
        // first, then fall back to text-matching the question so we still
        // recover answers when the question IDs differ (admin re-keyed).
        if (isEditing) {
          const seed = {};
          for (const q of finalList) {
            if (priorByQuestionId[q.id]) {
              seed[q.id] = priorByQuestionId[q.id];
            } else {
              const match = (editHints?.screeningAnswers || []).find(
                (a) => a?.question && q.question && a.question.trim().toLowerCase() === q.question.trim().toLowerCase(),
              );
              if (match?.answer) seed[q.id] = match.answer;
            }
          }
          if (Object.keys(seed).length) setAnswers(seed);
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, [flow]);

  if (loading) return <Loader />;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
        {isEditing ? (
          <View style={styles.editBanner}>
            <Ionicons name="create-outline" size={16} color={BRAND.ink} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.editBannerTitle}>EDITING ORDER</Text>
              <Text style={styles.editBannerText}>Your previous answers are pre-selected — change any below.</Text>
            </View>
          </View>
        ) : null}
        {questions.map((q, i) => (
          <Card key={q.id} style={styles.card}>
            <Text style={styles.qTitle}>{i + 1}. {q.question}</Text>
            {q.helperText ? <Text style={styles.qHelp}>{q.helperText}</Text> : null}
            {(() => {
              const opts = q.options || ['Yes', 'No'];
              const inline = opts.length <= 3 && opts.every((o) => String(o).length <= 14);
              return (
                <View style={inline ? { flexDirection: 'row', marginHorizontal: -3 } : null}>
                  {opts.map((opt) => {
                    const active = answers[q.id] === opt;
                    return (
                      <TouchableOpacity key={opt} style={[styles.ansRow, active && styles.ansRowActive, inline && { flex: 1, marginHorizontal: 3 }]} onPress={() => setAnswers({ ...answers, [q.id]: opt })}>
                        <Ionicons name={active ? 'checkmark-circle' : 'radio-button-off'} size={18} color={active ? BRAND.green : BRAND.ring} />
                        <Text style={styles.ansLabel}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}
          </Card>
        ))}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <PrimaryButton
          title="Continue →"
          style={{ backgroundColor: BRAND.green }}
          disabled={questions.some((q) => !answers[q.id])}
          onPress={() => navigation.navigate('SellScreenCondition', { ...params, device, workingCondition, screeningAnswers: questions.filter((q) => answers[q.id]).map((q) => ({ questionId: q.id, answer: answers[q.id], question: q.question })) })}
        />
      </View>
    </View>
  );
}
