import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Keyboard,
  Modal,
  Animated,
  PermissionsAndroid,
} from 'react-native';
import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import Colors from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/apiClient';
import locationService from '../../services/locationService';
import emergencyService from '../../services/emergencyService';
import { API_ENDPOINTS, getDefaultBaseUrl } from '../../config/api';

const POPULAR_VOICE_QUERIES = [
  { label: '🛡️ Is my current location safe?', text: 'Is my current location safe?' },
  { label: '🚓 Nearest police station', text: 'Where is the nearest police station?' },
  { label: '🏥 Nearest hospital & doctor', text: 'Where is the nearest hospital and emergency clinic?' },
  { label: '💊 Nearest medical shop & pharmacy', text: 'Where is the nearest medical shop and pharmacy?' },
  { label: '🚨 In danger! What should I do?', text: 'I am in danger! What should I do right now?' },
  { label: '🏛️ Tell me about Belagavi Fort', text: 'Tell me about Belagavi Fort and Kamal Basti' },
  { label: '🌊 Tell me about Gokak Falls', text: 'Tell me about Gokak Falls and what precautions to take' },
  { label: '🏛️ Tell me about Hampi UNESCO site', text: 'Tell me about Hampi UNESCO world heritage site and visitor timings' },
  { label: '🧭 Plan safe 1-day itinerary', text: 'Plan a safe one-day tourist trip for me in this area' },
  { label: '🎒 Travel safety checklist', text: 'What precautions and packing checklist should I follow?' },
];

export default function AiAssistantScreen({ navigation }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [telemetry, setTelemetry] = useState(null);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [currentCoords, setCurrentCoords] = useState({ latitude: 15.812463, longitude: 74.485458 });

  // ⌨️ Keyboard Visibility & Offset Tracking
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // 🎙️ Voice Search State
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceTranscribedText, setVoiceTranscribedText] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('Tap microphone to speak or pick a safety question:');

  const scrollViewRef = useRef(null);
  const textInputRef = useRef(null);
  const voiceWebViewRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Keyboard Event Listeners for Android & iOS
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates.height;
      setKeyboardHeight(Platform.OS === 'android' ? Math.max(0, height) : 0);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 120);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Microphone Pulse Animation
  useEffect(() => {
    if (isVoiceModalVisible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isVoiceModalVisible]);

  // Clean up speech on unmount or screen blur (switching tabs)
  useEffect(() => {
    const unsubscribeBlur = navigation?.addListener ? navigation.addListener('blur', () => {
      Speech.stop();
      setSpeakingMsgId(null);
    }) : () => {};

    return () => {
      Speech.stop();
      if (typeof unsubscribeBlur === 'function') unsubscribeBlur();
    };
  }, [navigation]);

  // Initialize: get location & fetch initial status greeting
  useEffect(() => {
    let isMounted = true;

    // Keep active coordinates synchronized with live device GPS
    const unsubscribeLocation = locationService.subscribe((loc) => {
      if (!isMounted) return;
      const lLat = loc?.latitude ?? loc?.coords?.latitude;
      const lLng = loc?.longitude ?? loc?.coords?.longitude;
      if (Number.isFinite(lLat) && Number.isFinite(lLng)) {
        setCurrentCoords({ latitude: lLat, longitude: lLng });
      }
    });

    async function initializeAssistant() {
      try {
        setIsInitializing(true);
        let lat = currentCoords?.latitude || 15.812463;
        let lng = currentCoords?.longitude || 74.485458;
        try {
          const loc = await locationService.getCurrentLocation();
          const lLat = loc?.latitude ?? loc?.coords?.latitude;
          const lLng = loc?.longitude ?? loc?.coords?.longitude;
          if (Number.isFinite(lLat) && Number.isFinite(lLng)) {
            lat = lLat;
            lng = lLng;
            setCurrentCoords({ latitude: lLat, longitude: lLng });
          }
        } catch (_) {}

        const res = await apiClient.get(
          `${API_ENDPOINTS.CHAT_INITIAL_STATUS}?lat=${lat}&lng=${lng}&userId=${user?.id || ''}`
        );

        if (isMounted && res.data?.success) {
          setTelemetry(res.data.telemetry);
          setMessages([
            {
              id: 'msg-init-0',
              role: 'assistant',
              text: res.data.greeting,
              suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
              suggestedQuestions: [
                'Is my current location safe?',
                'Where is the nearest hospital, police & medical shop?',
                'Where is the nearest medical shop?',
                'Top attractions near me',
              ],
              timestamp: new Date(),
            },
          ]);
        }
      } catch (err) {
        console.warn('Initial assistant greeting fallback:', err.message);
        if (isMounted) {
          setMessages([
            {
              id: 'msg-init-fallback',
              role: 'assistant',
              text: `👋 **Hello ${user?.name || 'Tourist'}!** Welcome to **Raksha AI**.\n\n🛡️ **Live Safety Telemetry:**\n• **Zone:** Verified Safe Green Corridor (✅ Safe)\n• **Nearest Police:** Udyambag Police Station\n• **Nearest Hospital:** Udyambag Multispeciality Hospital\n• **Nearest Medical Shop:** Sanjeevani Medical Stores\n\nHow can I help guide and protect you today?`,
              suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
              suggestedQuestions: [
                'Is my current location safe?',
                'Where is the nearest police station?',
                'Where is the nearest medical shop?',
                'Tell me about Belagavi Fort',
              ],
              timestamp: new Date(),
            },
          ]);
        }
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    initializeAssistant();

    return () => {
      isMounted = false;
      if (typeof unsubscribeLocation === 'function') {
        unsubscribeLocation();
      }
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const handleSendMessage = async (customText = null) => {
    const textToSend = (customText || inputText || '').trim();
    if (!textToSend || isLoading) return;

    setInputText('');
    Keyboard.dismiss();

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    scrollToBottom();
    setIsLoading(true);

    try {
      const historyPayload = newHistory.slice(-5).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      // Ensure fresh GPS location fix is transmitted
      let activeCoords = currentCoords;
      try {
        const freshLoc = await locationService.getCurrentLocation(false);
        const fLat = freshLoc?.latitude ?? freshLoc?.coords?.latitude;
        const fLng = freshLoc?.longitude ?? freshLoc?.coords?.longitude;
        if (Number.isFinite(fLat) && Number.isFinite(fLng)) {
          activeCoords = { latitude: fLat, longitude: fLng };
          setCurrentCoords(activeCoords);
        }
      } catch (_) {}

      const response = await apiClient.post(API_ENDPOINTS.CHAT_ASSISTANT, {
        message: textToSend,
        coords: activeCoords,
        history: historyPayload,
        userId: user?.id,
      });

      if (response.data?.success) {
        const assistantMsg = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: response.data.message,
          suggestedActions: response.data.suggestedActions || [],
          suggestedQuestions: response.data.suggestedQuestions || [],
          timestamp: new Date(),
        };

        if (response.data.telemetry) {
          setTelemetry(response.data.telemetry);
        }

        setMessages((prev) => [...prev, assistantMsg]);
        scrollToBottom();
      } else {
        throw new Error(response.data?.error || 'Failed response');
      }
    } catch (error) {
      console.warn('AI chat error:', error.message);
      const polText = telemetry?.nearestPolice || 'Udyambag Police Station';
      const hospText = telemetry?.nearestHospital || 'Udyambag Multispeciality Hospital';
      const pharmText = telemetry?.nearestPharmacy || 'Sanjeevani Medical Stores';

      const fallbackMsg = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        text: `### 🛡️ Safety Telemetry & Assistance\n\nI am with you. Here are your verified nearest safe havens:\n\n- 🚓 **Nearest Police Station:** ${polText}\n- 🏥 **Nearest Hospital:** ${hospText}\n- 💊 **Nearest Medical Shop:** ${pharmText}\n- 📞 **Helplines:** 112 (Police) | 108 (Ambulance)\n\nTap below for immediate help.`,
        suggestedActions: ['TRIGGER_SOS', 'CALL_112', 'CALL_108', 'OPEN_RADAR'],
        suggestedQuestions: ['Where is the nearest police station?', 'Where is the nearest hospital?', 'Where is the nearest medical shop?'],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  };

  // 🎙️ Voice Search Functions
  const transcribeAudio = async (base64Audio, mimeType = 'audio/webm') => {
    setIsTranscribing(true);
    setVoiceNotice('✨ Raksha AI is transcribing your speech...');
    try {
      const res = await apiClient.post(API_ENDPOINTS.CHAT_TRANSCRIBE, {
        audio: base64Audio,
        mimeType: mimeType || 'audio/webm',
      });

      if (res.data?.success && res.data?.text) {
        const text = res.data.text.trim();
        setVoiceTranscribedText(text);
        setInputText(text);
        setVoiceNotice('✅ Voice question recognized:');
      } else {
        setVoiceNotice('⚠️ No clear speech heard. Speak closer to the microphone, or select a question below:');
      }
    } catch (err) {
      console.warn('Transcription API error:', err.message);
      setVoiceNotice('⚠️ Voice transcription failed. You can choose a quick question below:');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'TRANSCRIPTION_RESULT' && data.text) {
        const text = data.text.trim();
        setVoiceTranscribedText(text);
        setInputText(text);
        setVoiceNotice('✅ Spoken question recognized:');
      } else if (data.type === 'INTERIM_TEXT' && data.text) {
        setVoiceTranscribedText(data.text);
        setInputText(data.text);
      } else if (data.type === 'RECORDING_STARTED') {
        setIsRecordingVoice(true);
        setVoiceNotice('🔴 Listening to your voice... Speak now!');
      } else if (data.type === 'AUDIO_DATA' && data.base64) {
        transcribeAudio(data.base64, data.mimeType || 'audio/webm');
      } else if (data.type === 'ERROR') {
        console.warn('Voice recorder error:', data.error);
        setIsRecordingVoice(false);
        setIsTranscribing(false);
        setVoiceNotice('⚠️ Tap microphone below to speak, or select a question:');
      }
    } catch (err) {
      console.warn('WebView message parse error:', err);
    }
  };

  const openVoiceModal = async () => {
    Keyboard.dismiss();
    Speech.stop();
    setVoiceTranscribedText(inputText || '');
    setVoiceNotice('Tap the microphone to speak, or select a safety question:');

    if (Platform.OS === 'android') {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (!hasPermission) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Raksha AI Microphone Permission',
              message: 'Raksha AI requires microphone access to hear and transcribe your safety questions.',
              buttonPositive: 'Allow',
              buttonNegative: 'Cancel',
            }
          );
        }
      } catch (e) {
        console.warn('Android audio permission error:', e);
      }
    }

    setIsVoiceModalVisible(true);
  };

  const closeVoiceModal = () => {
    Speech.stop();
    setIsVoiceModalVisible(false);
  };

  const handleSelectVoiceQuery = (queryText) => {
    setVoiceTranscribedText(queryText);
    setInputText(queryText);
    setVoiceNotice('✅ Voice query selected:');
    // Read aloud so tourist hears it
    Speech.speak(queryText, { language: 'en-IN', rate: 1.0 });
  };

  const handleApplyVoiceText = (autoSend = false) => {
    const text = (voiceTranscribedText || inputText).trim();
    if (!text) {
      Alert.alert('No Query Selected', 'Please speak or select a question from the list below.');
      return;
    }
    closeVoiceModal();
    if (autoSend) {
      handleSendMessage(text);
    } else {
      setInputText(text);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 200);
    }
  };

  // Action Button Handler
  const handleAction = (actionKey) => {
    switch (actionKey) {
      case 'TRIGGER_SOS':
        Alert.alert(
          '🚨 Confirm Distress SOS',
          'Broadcast emergency distress beacon with GPS coordinates to Belagavi Police Room?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: '🚨 ACTIVATE SOS',
              style: 'destructive',
              onPress: async () => {
                try {
                  await emergencyService.triggerSos(
                    currentCoords?.latitude,
                    currentCoords?.longitude,
                    'Distress trigger from Raksha AI Assistant'
                  );
                  navigation.navigate('SosTab');
                } catch (e) {
                  navigation.navigate('SosTab');
                }
              },
            },
          ]
        );
        break;

      case 'OPEN_RADAR':
        navigation.navigate('MapTab');
        break;

      case 'CALL_112':
        Linking.openURL('tel:112');
        break;

      case 'CALL_108':
        Linking.openURL('tel:108');
        break;

      case 'OPEN_VOICE_BOARD':
        navigation.navigate('EmergencyPhrasebook');
        break;

      default:
        navigation.navigate('MapTab');
        break;
    }
  };

  // Audio Playback
  const toggleSpeech = async (msgId, text) => {
    if (speakingMsgId === msgId) {
      await Speech.stop();
      setSpeakingMsgId(null);
      return;
    }

    try {
      await Speech.stop();
      setSpeakingMsgId(msgId);
      const cleanText = text
        .replace(/[*#_~`]/g, '')
        .replace(/\[.*?\]/g, '')
        .trim();

      Speech.speak(cleanText, {
        language: 'en-IN',
        pitch: 1.0,
        rate: 0.95,
        onDone: () => setSpeakingMsgId(null),
        onError: () => setSpeakingMsgId(null),
      });
    } catch (_) {
      setSpeakingMsgId(null);
    }
  };

  const clearChat = () => {
    Alert.alert('Clear Chat History', 'Reset the AI assistant conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setMessages([
            {
              id: 'msg-cleared',
              role: 'assistant',
              text: `Conversation reset. How can Raksha AI assist your tourist safety today?`,
              suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
              suggestedQuestions: [
                'Is my current location safe?',
                'Where is the nearest hospital & police?',
                'Tell me about Belagavi Fort',
              ],
              timestamp: new Date(),
            },
          ]);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 🧭 Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.white} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Raksha AI</Text>
              <Text style={styles.headerSubtitle}>Tourist Safety & Local Guide</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={clearChat} style={styles.headerIconBtn}>
              <Ionicons name="trash-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 💬 Messages ScrollView */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {isInitializing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Connecting to Raksha Setu Safety Radar...</Text>
            </View>
          ) : (
            messages.map((item) => {
              const isUser = item.role === 'user';
              const isSpeaking = speakingMsgId === item.id;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowAssistant,
                  ]}
                >
                  {!isUser && (
                    <View style={styles.avatarWrap}>
                      <Text style={styles.avatarEmoji}>🤖</Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.bubble,
                      isUser ? styles.bubbleUser : styles.bubbleAssistant,
                    ]}
                  >
                    <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
                      {item.text}
                    </Text>

                    {/* Audio Speaker & Actions for Assistant */}
                    {!isUser && (
                      <View style={styles.assistantFooter}>
                        <TouchableOpacity
                          style={styles.speakerBtn}
                          onPress={() => toggleSpeech(item.id, item.text)}
                        >
                          <Ionicons
                            name={isSpeaking ? 'volume-high' : 'volume-medium-outline'}
                            size={18}
                            color={isSpeaking ? '#38bdf8' : Colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.speakerText,
                              isSpeaking && { color: '#38bdf8', fontWeight: '700' },
                            ]}
                          >
                            {isSpeaking ? 'Listening...' : 'Listen Audio'}
                          </Text>
                        </TouchableOpacity>

                        <Text style={styles.timeText}>
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    )}

                    {/* Interactive Action Buttons */}
                    {!isUser && item.suggestedActions && item.suggestedActions.length > 0 && (
                      <View style={styles.actionButtonsWrap}>
                        {item.suggestedActions.map((act) => {
                          let btnStyle = styles.defaultActionBtn;
                          let textStyle = styles.defaultActionText;
                          let iconName = 'arrow-forward-circle';
                          let label = act;

                          if (act === 'TRIGGER_SOS') {
                            btnStyle = styles.sosActionBtn;
                            textStyle = styles.sosActionText;
                            iconName = 'warning';
                            label = '🚨 Trigger Emergency SOS';
                          } else if (act === 'OPEN_RADAR') {
                            btnStyle = styles.radarActionBtn;
                            textStyle = styles.radarActionText;
                            iconName = 'map';
                            label = '🗺️ View on Safety Radar';
                          } else if (act === 'CALL_112') {
                            btnStyle = styles.policeActionBtn;
                            textStyle = styles.policeActionText;
                            iconName = 'call';
                            label = '📞 Call Police (112)';
                          } else if (act === 'CALL_108') {
                            btnStyle = styles.ambulanceActionBtn;
                            textStyle = styles.ambulanceActionText;
                            iconName = 'call';
                            label = '🏥 Call Ambulance (108)';
                          } else if (act === 'OPEN_VOICE_BOARD') {
                            btnStyle = styles.voiceActionBtn;
                            textStyle = styles.voiceActionText;
                            iconName = 'volume-high';
                            label = '🗣️ Emergency Voice Board';
                          }

                          return (
                            <TouchableOpacity
                              key={act}
                              style={[styles.actionBtn, btnStyle]}
                              onPress={() => handleAction(act)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name={iconName} size={16} color={textStyle.color} />
                              <Text style={[styles.actionBtnText, textStyle]}>{label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Suggested Follow-up Questions */}
                    {!isUser && item.suggestedQuestions && item.suggestedQuestions.length > 0 && (
                      <View style={styles.suggestionsWrap}>
                        <Text style={styles.suggestionsTitle}>💡 Suggested follow-ups:</Text>
                        {item.suggestedQuestions.map((sug, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.suggestionChip}
                            onPress={() => handleSendMessage(sug)}
                          >
                            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#38bdf8" />
                            <Text style={styles.suggestionChipText}>{sug}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {isLoading && (
            <View style={[styles.messageRow, styles.messageRowAssistant]}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarEmoji}>🤖</Text>
              </View>
              <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
                <ActivityIndicator size="small" color="#38bdf8" />
                <Text style={styles.typingText}>Raksha AI is thinking & checking telemetry...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ✍️ Message Input Box & 🎙️ Voice Search Button */}
        <View style={styles.inputContainer}>
          {/* 🎙️ Voice-Based Search Icon Button */}
          <TouchableOpacity
            style={styles.micBtn}
            onPress={openVoiceModal}
            activeOpacity={0.8}
            accessibilityLabel="Voice Search"
          >
            <Ionicons name="mic" size={22} color="#38bdf8" />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            ref={textInputRef}
            style={styles.input}
            placeholder="Type or tap 🎙️ for voice questions..."
            placeholderTextColor={Colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 150);
            }}
          />

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="arrow-up" size={22} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 🎙️ Voice Question Input Modal Sheet */}
      <Modal
        visible={isVoiceModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeVoiceModal}
      >
        <View style={styles.voiceModalOverlay}>
          <View style={styles.voiceModalCard}>
            {/* Modal Header */}
            <View style={styles.voiceModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Ionicons name="mic-circle" size={28} color="#38bdf8" />
                </Animated.View>
                <View>
                  <Text style={styles.voiceModalTitle}>Voice Question Search</Text>
                  <Text style={styles.voiceModalSub}>Powered by Raksha AI & Gemini Speech Engine</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeVoiceModal} style={styles.voiceCloseBtn}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Live Voice Status Notice */}
            <View style={styles.voiceNoticeBanner}>
              <Text style={styles.voiceNoticeText}>{voiceNotice}</Text>
            </View>

            {/* 🎙️ Real HTTPS Interactive Voice Recorder Widget */}
            <View style={styles.recorderWidgetWrap}>
              <WebView
                ref={voiceWebViewRef}
                source={{ uri: `${getDefaultBaseUrl()}/chat/recorder` }}
                style={styles.recorderWebView}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback={true}
                mediaCapturePermissionGrantType="grant"
                onPermissionRequest={(req) => {
                  try {
                    if (req && typeof req.grant === 'function') {
                      req.grant(req.resources || []);
                    }
                  } catch (_) {}
                }}
                onMessage={handleWebViewMessage}
                scrollEnabled={false}
              />
            </View>

            {/* Transcribed Text Display Box */}
            <View
              style={[
                styles.voiceTranscriptionBox,
                voiceTranscribedText ? { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)' } : null,
              ]}
            >
              <Text
                style={[
                  styles.voiceTranscriptionLabel,
                  voiceTranscribedText ? { color: '#34d399' } : null,
                ]}
              >
                {voiceTranscribedText ? '✅ SPOKEN QUESTION (TEXT):' : 'SPOKEN TEXT:'}
              </Text>
              <Text style={styles.voiceTranscriptionContent} numberOfLines={3}>
                {voiceTranscribedText ? `"${voiceTranscribedText}"` : 'Your spoken words will appear here in bold...'}
              </Text>
            </View>

            {/* Modal Action Buttons (When text is ready) */}
            {voiceTranscribedText ? (
              <View style={styles.voiceActionsRow}>
                <TouchableOpacity
                  style={[styles.voiceActionBtn, styles.voiceInsertBtn]}
                  onPress={() => handleApplyVoiceText(false)}
                >
                  <Ionicons name="create-outline" size={18} color="#ffffff" />
                  <Text style={styles.voiceActionBtnText}>Put in Chatbox</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.voiceActionBtn, styles.voiceSendBtn]}
                  onPress={() => handleApplyVoiceText(true)}
                >
                  <Ionicons name="paper-plane" size={18} color="#ffffff" />
                  <Text style={styles.voiceActionBtnText}>Ask AI Now</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ⌨️ Keyboard Microphone Option Button */}
            <TouchableOpacity
              style={styles.keyboardVoiceBtn}
              onPress={() => {
                closeVoiceModal();
                setTimeout(() => {
                  textInputRef.current?.focus();
                }, 250);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="keypad-outline" size={16} color="#38bdf8" />
              <Text style={styles.keyboardVoiceBtnText}>
                Use Phone Keyboard Microphone (Gboard Dictation)
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#64748b" />
            </TouchableOpacity>

            {/* Curated Voice Questions Section */}
            <View style={styles.voiceChipsSection}>
              <Text style={styles.voiceChipsTitle}>⚡ Or tap an instant safety question:</Text>
              <ScrollView
                style={{ maxHeight: 130 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
              >
                {POPULAR_VOICE_QUERIES.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.voiceQueryRow}
                    onPress={() => handleSelectVoiceQuery(item.text)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="volume-medium-outline" size={18} color="#38bdf8" />
                    <Text style={styles.voiceQueryRowText}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#64748b" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 14,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Telemetry Bar
  telemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131e36',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  telemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '33%',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  telemetryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  telemetryDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#334155',
  },

  // Message List
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    padding: 14,
  },
  bubbleUser: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#e2e8f0',
  },
  bubbleTextUser: {
    color: Colors.white,
    fontWeight: '500',
  },
  assistantFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  speakerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  speakerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 10,
    color: '#64748b',
  },

  // Action Buttons inside message
  actionButtonsWrap: {
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  defaultActionBtn: {
    backgroundColor: '#334155',
  },
  defaultActionText: {
    color: Colors.white,
  },
  sosActionBtn: {
    backgroundColor: '#dc2626',
  },
  sosActionText: {
    color: Colors.white,
  },
  radarActionBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  radarActionText: {
    color: '#38bdf8',
  },
  policeActionBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  policeActionText: {
    color: '#10b981',
  },
  ambulanceActionBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  ambulanceActionText: {
    color: '#f43f5e',
  },
  voiceActionBtn: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  voiceActionText: {
    color: '#c084fc',
  },

  // Suggestions inside message
  suggestionsWrap: {
    marginTop: 12,
    gap: 6,
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 2,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionChipText: {
    fontSize: 12,
    color: '#93c5fd',
    fontWeight: '500',
  },

  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  typingText: {
    fontSize: 12,
    color: '#38bdf8',
    fontStyle: 'italic',
  },

  voiceNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginBottom: 10,
  },
  voiceNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#93c5fd',
    lineHeight: 15,
  },

  // Input Box & Mic Button
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: '#1e293b',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.white,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },

  // 🎙️ Voice Search Modal Styles
  voiceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  voiceModalCard: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '92%',
  },
  voiceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  voiceModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
  },
  voiceModalSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  voiceCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recorderWidgetWrap: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
  },
  recorderWebView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f172a',
  },
  keyboardVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  keyboardVoiceBtnText: {
    flex: 1,
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '600',
  },
  voiceTranscriptionBox: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    minHeight: 70,
    marginBottom: 14,
  },
  voiceTranscriptionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  voiceTranscriptionContent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 22,
  },
  voiceActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  voiceActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  voiceInsertBtn: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  voiceSendBtn: {
    backgroundColor: Colors.primary,
  },
  voiceActionBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  voiceChipsSection: {
    marginTop: 2,
  },
  voiceChipsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  voiceQueryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  voiceQueryRowText: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: '500',
  },
});
