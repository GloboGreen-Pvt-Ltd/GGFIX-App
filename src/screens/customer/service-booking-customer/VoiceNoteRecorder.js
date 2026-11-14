import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RecordingPresets, createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { ChevronDown, ChevronRight, Mic, Pause, Play, Square, Trash2 } from 'lucide-react-native';
import { notify } from '../../../components/confirm';
import { rf, rs } from '../../../utils/responsive';

/**
 * "Record Voice Note (optional)" card — ported from the Partner app's Devices &
 * Repair screen (ServicePriceEstimateScreen): a collapsed row with a chevron,
 * then Record → Recording… STOP → play / remove. Same expo-audio calls.
 *
 * Unlike Partner it does NOT upload on stop: the clip stays a local file
 * (`uri`) and RepairCompleteOrderScreen uploads it with the booking photos.
 * `onRecordingChange(true|false)` lets the host hold Continue while recording.
 */
const ACCENT = '#035C6C';
const ACCENT_30 = '#C7E6EA';
const MINT = '#E5F3F5';
const INK = '#111111';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const DANGER = '#DC2626';

export default function VoiceNoteRecorder({ uri, onChange, onRecordingChange }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // The recorder collapses to a single row with a chevron (Partner design).
  const [voiceOpen, setVoiceOpen] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingLiveRef = useRef(false);
  const soundRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => { onRecordingChange?.(isRecording); }, [isRecording]);

  // Tick the visible timer while recording.
  useEffect(() => {
    if (isRecording) {
      const start = Date.now();
      tickRef.current = setInterval(() => setRecordingMs(Date.now() - start), 250);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      setRecordingMs(0);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [isRecording]);

  // Release the recorder + player when leaving the screen, otherwise the next
  // visit can fail to acquire the mic.
  useEffect(() => () => {
    if (recordingLiveRef.current) { try { audioRecorder.stop(); } catch (_) {} }
    try { soundRef.current?.remove?.(); } catch (_) {}
  }, [audioRecorder]);

  const startRecording = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        notify('Microphone needed', 'Allow microphone access to record a voice note about the issue.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      recordingLiveRef.current = true;
      setIsRecording(true);
    } catch (e) {
      notify('Could not start recording', e?.message || 'Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      if (!recordingLiveRef.current) return;
      recordingLiveRef.current = false;
      await audioRecorder.stop();
      const out = audioRecorder.uri;
      if (out) onChange?.(out);
    } catch (e) {
      notify('Could not stop recording', e?.message || 'Please try again.');
    }
  };

  const togglePlayback = async () => {
    try {
      if (isPlaying && soundRef.current) {
        soundRef.current.pause();
        setIsPlaying(false);
        return;
      }
      if (!uri) return;
      if (soundRef.current) { try { soundRef.current.remove(); } catch (_) {} }
      const player = createAudioPlayer(uri);
      soundRef.current = player;
      player.addListener('playbackStatusUpdate', (status) => {
        if (status?.didJustFinish) setIsPlaying(false);
      });
      player.play();
      setIsPlaying(true);
    } catch (e) {
      notify('Could not play', e?.message || 'Try again.');
    }
  };

  const removeAudio = () => {
    try {
      if (isPlaying && soundRef.current) soundRef.current.pause();
      if (soundRef.current) soundRef.current.remove();
    } catch (_) {}
    soundRef.current = null;
    setIsPlaying(false);
    onChange?.('');
  };

  const recSeconds = Math.floor(recordingMs / 1000);
  const recLabel = `${String(Math.floor(recSeconds / 60)).padStart(2, '0')}:${String(recSeconds % 60).padStart(2, '0')}`;
  const hasClip = !!uri;
  // Recording and an attached clip both force the controls open.
  const voiceExpanded = voiceOpen || isRecording || hasClip;
  const voiceHint = isRecording ? `Recording… ${recLabel}` : hasClip ? 'Voice note attached' : '';

  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: rs(14), borderWidth: 1, borderColor: LINE, padding: rs(12) }}>
      <Pressable
        onPress={() => setVoiceOpen((v) => !v)}
        className="active:opacity-70"
        style={{ flexDirection: 'row', alignItems: 'center' }}
        accessibilityRole="button"
        accessibilityLabel={voiceExpanded ? 'Hide voice note controls' : 'Show voice note controls'}
      >
        <View style={{ height: rs(40), width: rs(40), borderRadius: rs(12), backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginRight: rs(10) }}>
          <Mic size={rf(18)} color={isRecording ? DANGER : ACCENT} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: rf(13), fontWeight: '700', color: INK }}>
            Record Voice Note
            <Text style={{ fontSize: rf(12), fontWeight: '400', color: MUTED }}> (optional)</Text>
          </Text>
          {voiceHint ? (
            <Text style={{ fontSize: rf(12), marginTop: rs(1), color: MUTED }} numberOfLines={1}>{voiceHint}</Text>
          ) : null}
        </View>
        {voiceExpanded
          ? <ChevronDown size={rf(18)} color="#9CA3AF" strokeWidth={2} />
          : <ChevronRight size={rf(18)} color="#9CA3AF" strokeWidth={2} />}
      </Pressable>

      {voiceExpanded ? (
        <View style={{ marginTop: rs(10) }}>
          {isRecording ? (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', borderRadius: rs(12), paddingHorizontal: rs(10), paddingVertical: rs(8),
                backgroundColor: '#FDECEC', borderWidth: 1, borderColor: 'rgba(220, 38, 38, 0.35)',
              }}
            >
              <View style={{ height: rs(10), width: rs(10), borderRadius: rs(5), backgroundColor: DANGER, marginRight: rs(8) }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rf(12), fontWeight: '600', color: DANGER }}>Recording…</Text>
                <Text style={{ fontSize: rf(11), fontWeight: '500', color: DANGER }}>{recLabel}</Text>
              </View>
              <Pressable
                onPress={stopRecording}
                className="active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel="Stop recording"
                style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36, backgroundColor: DANGER, borderRadius: 999, paddingHorizontal: rs(14), paddingVertical: rs(8) }}
              >
                <Square size={rf(12)} color="#fff" fill="#fff" />
                <Text style={{ fontSize: rf(12), fontWeight: '600', marginLeft: rs(6), color: '#FFFFFF' }}>STOP</Text>
              </Pressable>
            </View>
          ) : hasClip ? (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', borderRadius: rs(12), paddingHorizontal: rs(10), paddingVertical: rs(8),
                backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: ACCENT_30,
              }}
            >
              <Pressable
                onPress={togglePlayback}
                className="active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause voice note' : 'Play voice note'}
                style={{ height: rs(38), width: rs(38), borderRadius: rs(19), backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' }}
              >
                {isPlaying
                  ? <Pause size={rf(16)} color="#fff" fill="#fff" />
                  : <Play size={rf(16)} color="#fff" fill="#fff" />}
              </Pressable>
              <View style={{ flex: 1, marginLeft: rs(10) }}>
                <Text style={{ fontSize: rf(13), fontWeight: '600', color: INK }}>Voice note attached</Text>
                <Text style={{ fontSize: rf(12), color: MUTED }}>Tap play to preview · sent with your booking</Text>
              </View>
              <Pressable
                onPress={removeAudio}
                className="active:opacity-70"
                style={{ height: rs(36), width: rs(36), borderRadius: rs(18), backgroundColor: 'rgba(220, 38, 38, 0.12)', alignItems: 'center', justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Remove voice note"
              >
                <Trash2 size={rf(15)} color={DANGER} strokeWidth={2} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={startRecording}
              className="active:opacity-90"
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, backgroundColor: ACCENT, borderRadius: rs(12), paddingVertical: rs(10) }}
            >
              <Mic size={rf(16)} color="#fff" strokeWidth={2} />
              <Text style={{ fontSize: rf(13), fontWeight: '600', marginLeft: rs(8), color: '#FFFFFF' }}>Record voice note</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
