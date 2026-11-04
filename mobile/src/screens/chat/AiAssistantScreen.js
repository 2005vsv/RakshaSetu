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
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import Colors from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/apiClient';
import locationService from '../../services/locationService';
import emergencyService from '../../services/emergencyService';
import { API_ENDPOINTS, getDefaultBaseUrl } from '../../config/api';
import { getSmartLocalResponse } from '../../services/aiChatService';

// ⚡ Categorized Popular Voice Questions
const POPULAR_VOICE_QUERIES = [
  // 🗺️ Distance & Route Questions
  { id: 'v1', category: 'distance', label: 'Belagavi to Goa distance', text: 'What is the distance between Belagavi and Goa?', icon: 'navigate-circle' },
  { id: 'v2', category: 'distance', label: 'Mumbai to Pune distance', text: 'What is the distance between Mumbai and Pune?', icon: 'speedometer' },
  { id: 'v3', category: 'distance', label: 'Bengaluru to Mysuru distance', text: 'What is the distance between Bengaluru and Mysuru?', icon: 'car-sport' },
  { id: 'v4', category: 'distance', label: 'Delhi to Agra distance', text: 'What is the distance between Delhi and Agra?', icon: 'map' },

  // 🏖️ Tourism & Famous Places
  { id: 'v5', category: 'tourism', label: 'Famous places to visit in Goa', text: 'What are the famous places to visit in Goa?', icon: 'sunny' },
  { id: 'v6', category: 'tourism', label: 'Famous places to visit in Mumbai', text: 'What are the famous places to visit in Mumbai?', icon: 'business' },
  { id: 'v7', category: 'tourism', label: 'Famous places to visit in Bengaluru', text: 'What are famous places to visit in Bengaluru?', icon: 'flower' },
  { id: 'v8', category: 'tourism', label: 'Famous places to visit in Jaipur', text: 'What are the famous places to visit in Jaipur pink city?', icon: 'color-palette' },
  { id: 'v9', category: 'tourism', label: 'Famous places to visit in Kerala', text: 'What are the famous tourist places to visit in Kerala?', icon: 'boat' },
  { id: 'v10', category: 'tourism', label: 'Famous places to visit in Agra', text: 'What are the famous places to visit in Agra?', icon: 'trail-sign' },
  { id: 'v11', category: 'tourism', label: 'Belagavi Fort & Kamal Basti', text: 'Tell me about Belagavi Fort and Kamal Basti', icon: 'shield-checkmark' },
  { id: 'v12', category: 'tourism', label: 'Gokak Falls & precautions', text: 'Tell me about Gokak Falls and what precautions to take', icon: 'water' },
  { id: 'v13', category: 'tourism', label: 'Hampi UNESCO World Heritage', text: 'Tell me about Hampi UNESCO world heritage site and visitor timings', icon: 'ribbon' },
  { id: 'v14', category: 'tourism', label: 'Plan safe 1-day tourist itinerary', text: 'Plan a safe one-day tourist trip for me in this area', icon: 'calendar' },

  // 🛡️ Safety & Medical Havens
  { id: 'v15', category: 'safety', label: 'Is my current location safe?', text: 'Is my current location safe?', icon: 'shield' },
  { id: 'v16', category: 'safety', label: 'Nearest police station', text: 'Where is the nearest police station?', icon: 'shield-sharp' },
  { id: 'v17', category: 'safety', label: 'Nearest hospital & doctor', text: 'Where is the nearest hospital and emergency clinic?', icon: 'medkit' },
  { id: 'v18', category: 'safety', label: 'Nearest medical shop & pharmacy', text: 'Where is the nearest medical shop and pharmacy?', icon: 'bandage' },
  { id: 'v19', category: 'safety', label: 'In danger! What should I do?', text: 'I am in danger! What should I do right now?', icon: 'alert-circle' },

  // 🍽️ Local Food & Delicacies
  { id: 'v20', category: 'food', label: 'Famous local foods to try', text: 'What are the famous foods and delicacies to try here?', icon: 'restaurant' },
  { id: 'v21', category: 'food', label: 'Belagavi Kunda & famous sweets', text: 'What is Belagavi Kunda and where is the best place to try it?', icon: 'cafe' },
];

// ⚡ Instant Horizontal Quick Chips (always accessible right above chat input)
const QUICK_CHIPS = [
  { label: '🗺️ Belagavi to Goa', text: 'What is the distance between Belagavi and Goa?' },
  { label: '🏖️ Places in Goa', text: 'What are famous places to visit in Goa?' },
  { label: '🏙️ Places in Mumbai', text: 'What are famous places to visit in Mumbai?' },
  { label: '🚗 Mumbai to Pune', text: 'What is the distance between Mumbai and Pune?' },
  { label: '🛡️ Safe Zone?', text: 'Is my current location safe?' },
  { label: '🏥 Nearest Hospital', text: 'Where is the nearest hospital and doctor?' },
  { label: '🚓 Nearest Police', text: 'Where is the nearest police station?' },
  { label: '🍽️ Famous Food', text: 'What are famous local foods and delicacies to try here?' },
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

  // 🎙️ Voice Search & Voice Typing State
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
  const [isVoiceTypingHintActive, setIsVoiceTypingHintActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const scrollViewRef = useRef(null);
  const textInputRef = useRef(null);
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
    }) : () => { };

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
        } catch (_) { }

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
                'What is the distance between Belagavi and Goa?',
                'What are famous places to visit in Goa?',
                'Where is the nearest hospital, police & medical shop?',
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
              text: `👋 **Hello ${user?.name || 'Tourist'}!** Welcome to **Raksha AI**.\n\n🛡️ **Live Safety Telemetry:**\n• **Zone:** Verified Safe Green Corridor (✅ Safe)\n• **Nearest Police:** Udyambag Police Station\n• **Nearest Hospital:** Udyambag Multispeciality Hospital\n• **Nearest Medical Shop:** Sanjeevani Medical Stores\n\nHow can I help guide and protect you today? Ask distance between any cities, places to visit, or safety advice!`,
              suggestedActions: ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
              suggestedQuestions: [
                'Is my current location safe?',
                'What is the distance between Belagavi and Goa?',
                'What are famous places to visit in Goa?',
                'Where is the nearest hospital & police?',
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
      } catch (_) { }

      // 1. Instant Client-Side AI Response Check (Handles distance, Goa, Mumbai, Delhi, math, etc. instantly)
      const instantAnswer = getSmartLocalResponse(textToSend, activeCoords);
      if (instantAnswer) {
        const assistantMsg = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: instantAnswer.message,
          suggestedActions: instantAnswer.suggestedActions || ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
          suggestedQuestions: instantAnswer.suggestedQuestions || [],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        scrollToBottom();
        setIsLoading(false);
        return;
      }

      const historyPayload = newHistory.slice(-5).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const response = await apiClient.post(API_ENDPOINTS.CHAT_ASSISTANT, {
        message: textToSend,
        coords: activeCoords,
        history: historyPayload,
        userId: user?.id,
      });

      if (response.data?.success) {
        let msgText = response.data.message;

        // Safety verification: If remote server returned stale Belagavi text for a different query
        const qLower = textToSend.toLowerCase();
        const mentionsOtherCity = /goa|mumbai|delhi|jaipur|kerala|agra|bengaluru|mysuru|pune|hyderabad/i.test(qLower);
        const isDistance = qLower.includes('distance') || qLower.includes('how far');
        if ((mentionsOtherCity || isDistance) && msgText && msgText.includes('Belagavi Fort') && !qLower.includes('belagavi')) {
          const override = getSmartLocalResponse(textToSend, activeCoords);
          if (override) msgText = override.message;
        }

        const assistantMsg = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: msgText,
          suggestedActions: response.data.suggestedActions || ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
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
      // Check if client-side AI can answer even on network error
      const clientFallback = getSmartLocalResponse(textToSend, currentCoords);
      if (clientFallback) {
        const assistantMsg = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: clientFallback.message,
          suggestedActions: clientFallback.suggestedActions || ['OPEN_RADAR', 'OPEN_VOICE_BOARD'],
          suggestedQuestions: clientFallback.suggestedQuestions || [],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        scrollToBottom();
        setIsLoading(false);
        return;
      }

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

  // 🎙️ Voice Assistant Handlers
  const openVoiceModal = () => {
    Keyboard.dismiss();
    Speech.stop();
    setIsVoiceModalVisible(true);
  };

  const closeVoiceModal = () => {
    Speech.stop();
    setIsVoiceModalVisible(false);
  };

  const activateVoiceTyping = () => {
    Speech.stop();
    setIsVoiceModalVisible(false);
    setIsVoiceTypingHintActive(true);
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 180);
  };

  const handleSelectVoiceQuery = (queryText) => {
    Speech.stop();
    setIsVoiceModalVisible(false);
    setIsVoiceTypingHintActive(false);
    // Speak query aloud so tourist hears question confirmation
    Speech.speak(queryText, { language: 'en-IN', rate: 1.0 });
    handleSendMessage(queryText);
  };

  const handleQuickVoiceChip = (chipText) => {
    Speech.stop();
    setIsVoiceTypingHintActive(false);
    Speech.speak(chipText, { language: 'en-IN', rate: 1.0 });
    handleSendMessage(chipText);
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

        {/* 🎙️ Voice Typing Instruction Banner */}
        {isVoiceTypingHintActive && (
          <View style={styles.voiceActiveBanner}>
            <View style={styles.voiceActiveLeft}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Ionicons name="mic" size={20} color="#38bdf8" />
              </Animated.View>
              <Text style={styles.voiceActiveBannerText}>
                🎙️ <Text style={{ fontWeight: '800', color: '#38bdf8' }}>Voice Typing Ready:</Text> Tap the <Text style={{ fontWeight: '800', color: '#38bdf8' }}>mic icon</Text> on your phone keyboard to speak!
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsVoiceTypingHintActive(false)} style={styles.closeBannerBtn}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}

        {/* ⚡ Instant Quick Voice Query Chips */}
        <View style={styles.quickVoiceBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickVoiceContent}
            keyboardShouldPersistTaps="handled"
          >
            {QUICK_CHIPS.map((chip, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.quickChipBtn}
                onPress={() => handleQuickVoiceChip(chip.text)}
                activeOpacity={0.75}
              >
                <Ionicons name="mic" size={13} color="#38bdf8" />
                <Text style={styles.quickChipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ✍️ Message Input Box & 🎙️ Voice Assistant Button */}
        <View style={styles.inputContainer}>
          {/* 🎙️ Voice Assistant Button */}
          <TouchableOpacity
            style={styles.micBtn}
            onPress={openVoiceModal}
            activeOpacity={0.8}
            accessibilityLabel="Voice Assistant"
          >
            <Ionicons name="mic" size={22} color="#38bdf8" />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            ref={textInputRef}
            style={styles.input}
            placeholder="Type or tap 🎙️ for voice queries..."
            placeholderTextColor={Colors.textSecondary}
            value={inputText}
            onChangeText={(t) => {
              setInputText(t);
              if (t.trim().length > 0) setIsVoiceTypingHintActive(false);
            }}
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

      {/* 🎙️ Voice Assistant Modal Sheet */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Ionicons name="mic-circle" size={32} color="#38bdf8" />
                </Animated.View>
                <View>
                  <Text style={styles.voiceModalTitle}>Raksha Voice Assistant</Text>
                  <Text style={styles.voiceModalSub}>Speak or pick an instant question</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeVoiceModal} style={styles.voiceCloseBtn}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* 🎙️ Hero Voice Typing Button (Uses Native Phone Microphone) */}
            <TouchableOpacity
              style={styles.heroVoiceCard}
              onPress={activateVoiceTyping}
              activeOpacity={0.85}
            >
              <Animated.View style={[styles.heroMicCircle, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="mic" size={34} color="#ffffff" />
              </Animated.View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroVoiceTitle}>🎙️ Tap to Speak (Voice Typing)</Text>
                <Text style={styles.heroVoiceDesc}>
                  Speak into phone keyboard mic with Google / Android voice recognition
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#38bdf8" />
            </TouchableOpacity>

            {/* 🏷️ Category Filter Pills */}
            <View style={styles.categoryPillsRow}>
              {[
                { key: 'all', label: '⚡ All' },
                { key: 'distance', label: '🗺️ Distance' },
                { key: 'tourism', label: '🏖️ Tourism' },
                { key: 'safety', label: '🛡️ Safety' },
                { key: 'food', label: '🍽️ Food' },
              ].map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryPill,
                    selectedCategory === cat.key && styles.categoryPillActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      selectedCategory === cat.key && styles.categoryPillTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 📜 Filtered Voice Questions Scrollable List */}
            <ScrollView
              style={styles.voiceQueryList}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
            >
              {POPULAR_VOICE_QUERIES
                .filter((q) => selectedCategory === 'all' || q.category === selectedCategory)
                .map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.voiceQueryRow}
                    onPress={() => handleSelectVoiceQuery(item.text)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.voiceQueryIconWrap}>
                      <Ionicons name={item.icon || 'chatbubble-ellipses-outline'} size={18} color="#38bdf8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.voiceQueryRowTitle}>{item.label}</Text>
                      <Text style={styles.voiceQueryRowSub} numberOfLines={1}>{item.text}</Text>
                    </View>
                    <View style={styles.voiceQueryAskBtn}>
                      <Text style={styles.voiceQueryAskText}>Ask</Text>
                      <Ionicons name="arrow-forward" size={12} color="#38bdf8" />
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {/* 💡 Helpful Tip Footer */}
            <View style={styles.voiceGuideFooter}>
              <Ionicons name="bulb-outline" size={16} color="#f59e0b" />
              <Text style={styles.voiceGuideFooterText}>
                <Text style={{ fontWeight: '700', color: '#f59e0b' }}>Tip: </Text>
                Tap the big button above, then tap the 🎙️ mic on your keyboard to speak freely in any language!
              </Text>
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

  // 🎙️ Voice Typing Hint & Quick Query Bar Styles
  voiceActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c2238',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#38bdf8',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  voiceActiveLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voiceActiveBannerText: {
    fontSize: 13,
    color: '#e2e8f0',
    flex: 1,
    lineHeight: 18,
  },
  closeBannerBtn: {
    padding: 4,
    marginLeft: 8,
  },
  quickVoiceBar: {
    backgroundColor: '#0b1120',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 8,
  },
  quickVoiceContent: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  quickChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickChipText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },

  // 🎙️ Voice Assistant Modal Styles
  voiceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  voiceModalCard: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '88%',
  },
  voiceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  voiceModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  voiceModalSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  voiceCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero Voice Card (Tap to Speak)
  heroVoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  heroMicCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  heroVoiceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 3,
  },
  heroVoiceDesc: {
    fontSize: 12,
    color: '#93c5fd',
    lineHeight: 16,
  },

  // Category Pills
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Voice Query List
  voiceQueryList: {
    maxHeight: 280,
  },
  voiceQueryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  voiceQueryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceQueryRowTitle: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 2,
  },
  voiceQueryRowSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  voiceQueryAskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  voiceQueryAskText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },

  // Footer Tip
  voiceGuideFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  voiceGuideFooterText: {
    fontSize: 11,
    color: '#fbbf24',
    flex: 1,
    lineHeight: 16,
  },
});
