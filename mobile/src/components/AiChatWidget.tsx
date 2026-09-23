import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendChatMessage } from '../aiApi';
import { colors } from '../theme';
import type { ChatMessage } from '../types';

export default function AiChatWidget() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages, open, loading]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const history = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(history);
    setInput('');
    setLoading(true);
    try {
      const response = await sendChatMessage(history);
      setMessages([...history, { role: 'assistant', content: response.reply }]);
    } catch (requestError) {
      console.error('[VAULT AI] Chat request failed.', requestError);
      const message = requestError instanceof Error ? requestError.message : 'The assistant is unavailable right now.';
      setMessages([...history, { role: 'assistant', content: message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.widget, { bottom: insets.bottom + 20, right: 20 }]} pointerEvents="box-none">
      <Pressable
        style={styles.toggle}
        onPress={() => setOpen(true)}
        accessibilityLabel="Open shopping assistant"
      >
        <Text style={styles.toggleText}>✦</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Text style={styles.headerText}>✦ VAULT Assistant</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close chat" hitSlop={8}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
            {messages.length === 0 && (
              <Text style={[styles.bubble, styles.assistantBubble]}>
                สวัสดีค่ะ ถามอะไรเกี่ยวกับสินค้าหรือคำสั่งซื้อของคุณได้เลยค่ะ
              </Text>
            )}
            {messages.map((message, index) => (
              <Text key={index} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                {message.content}
              </Text>
            ))}
            {loading && <Text style={[styles.bubble, styles.assistantBubble, styles.typing]}>กำลังพิมพ์…</Text>}
          </ScrollView>
          <View style={[styles.form, { paddingBottom: insets.bottom + 12 }]}>
            <TextInput
              style={styles.input}
              value={input}
              placeholder="พิมพ์ข้อความ…"
              placeholderTextColor="#a3ab9c"
              editable={!loading}
              onChangeText={setInput}
              onSubmitEditing={() => void send()}
            />
            <Pressable
              style={[styles.sendButton, (loading || !input.trim()) && styles.sendButtonDisabled]}
              onPress={() => void send()}
              disabled={loading || !input.trim()}
              accessibilityLabel="Send message"
            >
              <Text style={styles.sendButtonText}>↗</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: { position: 'absolute', zIndex: 40 },
  toggle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.darkGreen,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#294638', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  toggleText: { color: '#fff', fontSize: 22 },
  sheet: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.darkGreen, paddingHorizontal: 18, paddingVertical: 16 },
  headerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  close: { color: '#fff', fontSize: 22, lineHeight: 24 },
  messages: { flex: 1, backgroundColor: colors.background },
  messagesContent: { padding: 16, gap: 10 },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, fontSize: 13, lineHeight: 19 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.darkGreen, color: '#fff', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#efede6', color: colors.text, borderBottomLeftRadius: 4 },
  typing: { opacity: 0.6 },
  form: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.headerBorder },
  input: { flex: 1, backgroundColor: '#efede6', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: colors.text },
  sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.darkGreen, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontSize: 16 },
});
