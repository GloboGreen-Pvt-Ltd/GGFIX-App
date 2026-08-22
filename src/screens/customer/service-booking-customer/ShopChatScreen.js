import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Phone,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  Camera,
  Mic,
  StopCircle,
  ShieldCheck,
  MessageCircle,
  CheckCheck,
  Check,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Loader, EmptyState, Badge } from '../../../components/rnr';
import { notify } from '../../../components/confirm';
import {
  openChat,
  getChatMessages,
  sendChatMessage,
  markChatRead,
  pingChatTyping,
  pingChatPresence,
} from '../../../api/marketplace';
import { uploadMedia } from '../../../api/masterData';
import { getShop } from '../../../api/shops';
import { rf } from '../../../utils/responsive';

const QUICK_REPLIES = [
  'Hi, I need a quote for a repair',
  'Is doorstep pickup available?',
  'How long will it take?',
  'Do you provide warranty?',
];

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function groupByDay(messages) {
  const groups = [];
  let lastDay = null;
  for (const m of messages) {
    const d = m.createdAt ? new Date(m.createdAt) : new Date();
    const key = d.toDateString();
    if (key !== lastDay) {
      groups.push({ type: 'date', key, label: dayLabel(d) });
      lastDay = key;
    }
    groups.push({ type: 'msg', message: m });
  }
  return groups;
}

function dayLabel(d) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function lastSeenLabel(online, lastSeenAt) {
  if (online) return 'Online · Typically replies in ~10 min';
  if (!lastSeenAt) return 'Tap to view shop profile';
  const d = new Date(lastSeenAt);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs}h ago`;
  return `Last seen on ${d.toLocaleDateString([], { day: '2-digit', month: 'short' })}`;
}

function useVoiceRecorder() {
  const [recording, setRecording] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const start = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const r = new Audio.Recording();
      await r.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await r.startAsync();
      setRecording(r);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return r;
    } catch {
      return null;
    }
  }, []);

  const stop = useCallback(async () => {
    if (!recording) return null;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setRecording(null);
      const dur = elapsed;
      setElapsed(0);
      return { uri, durationSec: dur };
    } catch {
      return null;
    }
  }, [recording, elapsed]);

  const cancel = useCallback(async () => {
    if (!recording) return;
    try { await recording.stopAndUnloadAsync(); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(null);
    setElapsed(0);
  }, [recording]);

  return { recording, elapsed, start, stop, cancel };
}

function AudioBubbleRow({ url, mine }) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef(null);
  const toggle = useCallback(async () => {
    try {
      if (playing) {
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
        setPlaying(false);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st?.didJustFinish) { setPlaying(false); sound.unloadAsync().catch(() => {}); soundRef.current = null; }
      });
      await sound.playAsync();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [playing, url]);
  return (
    <View className="flex-row items-center px-1 py-1 min-w-[160px]">
      <Pressable onPress={toggle} className="h-8 w-8 rounded-full items-center justify-center"
                 style={{ backgroundColor: mine ? 'rgba(255,255,255,0.25)' : '#DCFCE7' }}>
        {playing
          ? <StopCircle size={18} color={mine ? '#fff' : '#004C40'} />
          : <Mic size={16} color={mine ? '#fff' : '#004C40'} />}
      </Pressable>
      <Text className={`ml-2 ${mine ? 'text-white/90' : 'text-text-muted'}`} style={{ fontSize: rf(11) }}>
        {playing ? 'Playing voice note…' : 'Voice message · tap to play'}
      </Text>
    </View>
  );
}

export default function ShopChatScreen({ navigation, route }) {
  const shopId = route?.params?.shopId;
  const isEnquiry = route?.params?.mode === 'ENQUIRY';
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [shop, setShop] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);
  const typingTimerRef = useRef(null);
  const voice = useVoiceRecorder();

  const refresh = useCallback(async (threadId) => {
    if (!threadId) return;
    try {
      const [m, t] = await Promise.all([
        getChatMessages(threadId).catch(() => null),
        openChat(shopId).catch(() => null), // returns refreshed thread (incl. counterpart presence/typing)
      ]);
      if (Array.isArray(m)) setMessages(m);
      if (t) setThread(t);
    } catch {}
  }, [shopId]);

  const bootstrap = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      pingChatPresence().catch(() => {});
      const s = shopId ? await getShop(shopId).catch(() => null) : null;
      setShop(s);
      try {
        const t = await openChat(shopId);
        setThread(t);
        if (t?.id) {
          const m = await getChatMessages(t.id).catch(() => []);
          setMessages(m);
          markChatRead(t.id).catch(() => {});
        }
      } catch (e) {
        setLoadError(e?.message || 'Could not open chat with this shop.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { bootstrap(); }, [shopId]);

  // The Android window resizes when the keyboard opens (adjustResize), so the OS
  // itself lifts the composer above the keyboard — no KeyboardAvoidingView or
  // manual padding needed (either would double-lift or leave a residual gap on
  // dismiss). We only track whether the keyboard is open, to switch the
  // composer's bottom padding (small while typing vs. nav-bar clearance closed).
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Constant clearance so the closed composer looks identical before and after
  // the keyboard has been used.
  const bottomInset = Math.max(insets.bottom, 12);

  // Poll every 5s for new shop replies + counterpart presence/typing.
  useEffect(() => {
    if (!thread?.id) return undefined;
    pollRef.current = setInterval(async () => {
      await refresh(thread.id);
      markChatRead(thread.id).catch(() => {});
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [thread?.id, refresh]);

  const onChangeText = (v) => {
    setText(v);
    if (!thread?.id) return;
    pingChatTyping(thread.id, true).catch(() => {});
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      pingChatTyping(thread.id, false).catch(() => {});
    }, 1500);
  };

  const pickImage = async (fromCamera = false) => {
    if (!thread?.id) return;
    try {
      setAttaching(true);
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const r = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (r.canceled || !r.assets?.[0]) return;
      const url = await uploadMedia(r.assets[0], 'chat');
      if (url) await send('', { url, type: 'IMAGE' });
    } finally {
      setAttaching(false);
    }
  };

  const toggleVoice = async () => {
    if (!thread?.id) return;
    if (voice.recording) {
      const out = await voice.stop();
      if (out?.uri) {
        const asset = { uri: out.uri, fileName: `voice-${Date.now()}.m4a`, mimeType: 'audio/m4a' };
        const url = await uploadMedia(asset, 'chat').catch(() => null);
        if (url) await send('', { url, type: 'AUDIO' });
      }
    } else {
      await voice.start();
    }
  };

  // Optimistic send: shows the bubble immediately, even before API replies.
  const send = async (overrideText, attachment) => {
    const body = (overrideText ?? text).trim();
    if (!body && !attachment) return;
    if (!overrideText && !attachment) setText('');

    // If the thread didn't open, surface that — don't silently swallow the tap.
    if (!thread?.id) {
      notify(
        'Chat not connected',
        loadError
          ? `${loadError}\n\nTap retry on the banner to reconnect.`
          : 'Still connecting to the shop. Please wait a moment and try again.',
      );
      if (!overrideText && !attachment) setText(body);
      return;
    }

    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      sender: 'CUSTOMER',
      body,
      attachmentUrl: attachment?.url,
      attachmentType: attachment?.type,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((m) => [...m, optimistic]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    setSending(true);
    try {
      const sent = await sendChatMessage(thread.id, {
        body,
        attachmentUrl: attachment?.url,
        attachmentType: attachment?.type,
      });
      setMessages((m) => m.map((x) => (x.id === tempId ? { ...sent, pending: false } : x)));
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, failed: true, pending: false } : x)));
      notify("Couldn't send", e?.message || 'Try again. Check that marketplace-service (port 8087) is running.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loader label="Opening chat..." />;

  const groups = groupByDay(messages);
  const showWelcome = messages.length === 0;
  const shopName = thread?.counterpartName || shop?.name || 'Shop';
  const online = !!thread?.counterpartOnline;
  const typing = !!thread?.counterpartTyping;
  const subtitle = typing
    ? 'typing…'
    : lastSeenLabel(online, thread?.counterpartLastSeenAt);

  return (
    <View className="flex-1 bg-background">
      {/* Custom header (replaces default stack header) */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        <View className="flex-row items-center px-3 py-2 bg-card border-b border-border"
              style={{ shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-9 w-9 rounded-full bg-background items-center justify-center active:opacity-70"
          >
            <ChevronLeft size={20} color="#0F172A" />
          </Pressable>
          <View className="h-10 w-10 rounded-full bg-primary items-center justify-center ml-2">
            <Text className="text-white font-extrabold" style={{ fontSize: rf(14) }}>{shopName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View className="flex-1 ml-2.5">
            <Text className="font-extrabold text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{shopName}</Text>
            <View className="flex-row items-center mt-0.5">
              {online ? <View className="h-1.5 w-1.5 rounded-full bg-success mr-1" /> : null}
              <Text className={` ${typing ? 'italic font-semibold text-success' : 'text-text-muted'}`} style={{ fontSize: rf(10) }} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => (shop?.mobile || shop?.phone) && notify('Call shop', `Dial ${shop.mobile || shop.phone}`)}
            className="h-9 w-9 rounded-full bg-success/10 items-center justify-center ml-1 active:opacity-70"
          >
            <Phone size={16} color="#004C40" />
          </Pressable>
          <Pressable
            onPress={() => {}}
            className="h-9 w-9 rounded-full bg-background items-center justify-center ml-1 active:opacity-70"
          >
            <MoreVertical size={16} color="#64748B" />
          </Pressable>
        </View>

        {/* Mode banner */}
        {isEnquiry ? (
          <View className="bg-success/10 border-b border-success/20 px-4 py-2 flex-row items-center">
            <MessageCircle size={12} color="#004C40" />
            <Text className="font-bold text-success ml-1.5" style={{ fontSize: rf(11) }}>ENQUIRY MODE</Text>
            <Text className="text-text-muted ml-2 flex-1" style={{ fontSize: rf(11) }} numberOfLines={1}>
              Free chat · No booking yet
            </Text>
          </View>
        ) : null}

        {/* Connection failure banner */}
        {!loading && !thread ? (
          <View className="bg-danger/10 border-b border-danger/30 px-4 py-2 flex-row items-center">
            <View className="h-2 w-2 rounded-full bg-danger mr-2" />
            <View className="flex-1 pr-2">
              <Text className="font-extrabold text-danger" style={{ fontSize: rf(12) }} numberOfLines={1}>Couldn't connect to chat</Text>
              <Text className="text-text-muted" style={{ fontSize: rf(10) }} numberOfLines={2}>
                {loadError || 'marketplace-service may be offline.'}
              </Text>
            </View>
            <Pressable
              onPress={bootstrap}
              className="bg-danger rounded-full px-3 py-1 active:opacity-80"
            >
              <Text className="text-white font-bold" style={{ fontSize: rf(11) }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>

      <View className="flex-1">
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {/* Encryption notice */}
          <View className="self-center bg-card border border-border rounded-full px-3 py-1 mb-3 flex-row items-center">
            <ShieldCheck size={11} color="#004C40" />
            <Text className="text-text-muted ml-1" style={{ fontSize: rf(10) }}>
              Encrypted via ggfix · Booking-safe chat
            </Text>
          </View>

          {showWelcome ? (
            <View className="flex-1 items-center">
              <EmptyState
                icon={<MessageCircle size={28} color="#00008B" />}
                title={`Chat with ${shopName}`}
                description="Send a message to start the conversation. The shop typically replies within 10 minutes."
              />

              <View className="px-1">
                <Text className="font-extrabold text-text-muted tracking-widest mb-2 text-center" style={{ fontSize: rf(11) }}>QUICK REPLIES</Text>
                <View className="items-center">
                  {QUICK_REPLIES.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => send(q)}
                      className="bg-card border border-primary/30 rounded-full px-4 py-2 mb-2 active:opacity-80"
                    >
                      <Text className="font-bold text-primary" style={{ fontSize: rf(12) }}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            groups.map((g, idx) => {
              if (g.type === 'date') {
                return (
                  <View key={`d-${idx}`} className="items-center my-2">
                    <View className="bg-card border border-border rounded-full px-3 py-0.5">
                      <Text className="font-bold text-text-muted" style={{ fontSize: rf(10) }}>{g.label}</Text>
                    </View>
                  </View>
                );
              }
              const m = g.message;
              const mine = m.sender === 'CUSTOMER';
              const bubbleBg = m.failed
                ? 'bg-danger/10 border border-danger/30 rounded-2xl rounded-br-sm'
                : mine
                  ? `${m.pending ? 'bg-primary/70' : 'bg-primary'} rounded-2xl rounded-br-sm`
                  : 'bg-card border border-border rounded-2xl rounded-bl-sm';
              const txtColor = m.failed ? 'text-danger' : mine ? 'text-white' : 'text-text';
              const metaColor = m.failed ? 'text-danger/70' : mine ? 'text-white/70' : 'text-text-muted';
              const isImage = m.attachmentType === 'IMAGE' && m.attachmentUrl;
              const isAudio = m.attachmentType === 'AUDIO' && m.attachmentUrl;
              return (
                <View key={m.id || idx} className={`${mine ? 'items-end' : 'items-start'} mb-1.5`}>
                  <View className={`max-w-[82%] px-3 py-2 ${bubbleBg}`}>
                    {isImage ? (
                      <Image
                        source={{ uri: m.attachmentUrl }}
                        style={{ width: 220, height: 160, borderRadius: 10, marginBottom: m.body ? 6 : 0 }}
                        resizeMode="cover"
                      />
                    ) : null}
                    {isAudio ? <AudioBubbleRow url={m.attachmentUrl} mine={mine} /> : null}
                    {m.body ? <Text className={` leading-5 ${txtColor}`} style={{ fontSize: rf(13.5) }}>{m.body}</Text> : null}
                    <View className="flex-row items-center justify-end mt-1">
                      <Text className={` ${metaColor}`} style={{ fontSize: rf(10) }}>
                        {m.failed ? 'Failed to send' : (m.pending ? 'Sending...' : formatTime(m.createdAt))}
                      </Text>
                      {mine && !m.pending && !m.failed ? (
                        (m.read || m.readAt)
                          ? <CheckCheck size={11} color="#A7F3D0" style={{ marginLeft: 4 }} />
                          : <Check size={11} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
                      ) : null}
                    </View>
                  </View>
                  {m.failed ? (
                    <Pressable
                      onPress={() => {
                        setMessages((arr) => arr.filter((x) => x.id !== m.id));
                        send(m.body);
                      }}
                      className="mt-1 mr-1 active:opacity-70"
                    >
                      <Text className="font-bold text-danger underline" style={{ fontSize: rf(10) }}>Tap to retry</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Composer. When the keyboard is closed, pad the bottom by the safe-area
            inset so the white bar extends behind the nav bar and the input row
            sits just above the nav buttons. When open, the keyboard covers that
            area, so only a little breathing room is needed. */}
        <View className="px-3 pt-2 bg-card border-t border-border"
              style={{ paddingBottom: keyboardOpen ? 10 : bottomInset, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: -3 }, elevation: 8 }}>
          {voice.recording ? (
            <View className="flex-row items-center bg-danger/10 border border-danger/30 rounded-2xl px-3 py-2">
              <View className="h-2.5 w-2.5 rounded-full bg-danger mr-2" />
              <Text className="font-bold text-danger flex-1" style={{ fontSize: rf(12) }}>
                Recording… {String(Math.floor(voice.elapsed / 60)).padStart(2, '0')}:{String(voice.elapsed % 60).padStart(2, '0')}
              </Text>
              <Pressable onPress={voice.cancel} className="px-2 py-1 mr-1 active:opacity-70">
                <Text className="font-bold text-text-muted" style={{ fontSize: rf(11) }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={toggleVoice} className="h-9 w-9 rounded-full items-center justify-center bg-primary">
                <Send size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View className="flex-row items-end">
              <View className="flex-1 bg-background border border-border rounded-3xl flex-row items-center px-2 py-1">
                <Pressable onPress={() => pickImage(false)} disabled={attaching} className="h-9 w-9 items-center justify-center active:opacity-70">
                  <Paperclip size={18} color="#64748B" />
                </Pressable>
                <TextInput
                  placeholder="Type a message..."
                  placeholderTextColor="#94A3B8"
                  value={text}
                  onChangeText={onChangeText}
                  multiline
                  maxLength={1000}
                  className="flex-1 text-text py-2 px-1"
                  style={{ fontSize: rf(14), maxHeight: 100 }}
                />
                <Pressable className="h-9 w-9 items-center justify-center active:opacity-70 mr-0.5">
                  <Smile size={18} color="#64748B" />
                </Pressable>
                <Pressable onPress={() => pickImage(true)} disabled={attaching} className="h-9 w-9 items-center justify-center active:opacity-70 mr-0.5">
                  <Camera size={18} color="#64748B" />
                </Pressable>
              </View>
              {text.trim() ? (
                <Pressable
                  onPress={() => send()}
                  disabled={sending}
                  className="h-12 w-12 rounded-full ml-2 items-center justify-center bg-primary"
                  style={{ shadowColor: '#00008B', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
                >
                  <Send size={18} color="#fff" style={{ marginLeft: -2 }} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={toggleVoice}
                  className="h-12 w-12 rounded-full ml-2 items-center justify-center bg-primary"
                >
                  <Mic size={18} color="#fff" />
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

