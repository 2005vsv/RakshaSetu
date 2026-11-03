import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Vibration,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import Colors from '../../theme/colors';
import {
  SUPPORTED_LANGUAGES,
  PHRASE_CATEGORIES,
  EMERGENCY_PHRASES,
} from '../../data/emergencyPhrases';
import translationService from '../../services/translationService';

export default function EmergencyPhrasebookScreen({ navigation }) {
  const [selectedLang, setSelectedLang] = useState('kn'); // Default to Local State (Kannada)
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeSpeakingId, setActiveSpeakingId] = useState(null);
  const [fullscreenData, setFullscreenData] = useState(null);

  // Custom text & real-time translation state
  const [customText, setCustomText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translatedForLang, setTranslatedForLang] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeakingCustom, setIsSpeakingCustom] = useState(false);

  // Stop any ongoing speech when leaving screen
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang) || SUPPORTED_LANGUAGES[0];

  // Re-translate custom text when user changes language tab
  useEffect(() => {
    if (customText.trim() && translatedText && translatedForLang !== selectedLang) {
      handleTranslateOnly(customText, selectedLang);
    }
  }, [selectedLang]);

  // Translate custom text without automatically speaking
  const handleTranslateOnly = async (textToTranslate = customText, targetLang = selectedLang) => {
    if (!textToTranslate || !textToTranslate.trim()) return;
    setIsTranslating(true);
    try {
      const translated = await translationService.translateText(textToTranslate.trim(), targetLang);
      setTranslatedText(translated);
      setTranslatedForLang(targetLang);
    } catch (err) {
      console.warn('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Play audio for a pre-saved phrase
  const handlePlayPhrase = useCallback(
    async (phrase) => {
      Vibration.vibrate([0, 30, 20, 30]);

      if (activeSpeakingId === phrase.id) {
        Speech.stop();
        setActiveSpeakingId(null);
        return;
      }

      Speech.stop();
      setIsSpeakingCustom(false);
      setActiveSpeakingId(phrase.id);

      const trans = phrase.translations[selectedLang] || phrase.translations.en;
      const speechText = trans.text || phrase.english;

      try {
        Speech.speak(speechText, {
          language: currentLangObj.speechCode,
          pitch: 1.0,
          rate: 0.82, // Clear, steady cadence for emergency clarity
          onDone: () => setActiveSpeakingId(null),
          onStopped: () => setActiveSpeakingId(null),
          onError: (e) => {
            console.warn('Speech error:', e);
            setActiveSpeakingId(null);
            Alert.alert(
              'Speech Notice',
              'TTS playback unavailable. Please show the large screen text to the responder.'
            );
          },
        });
      } catch (err) {
        console.warn('Speech exception:', err);
        setActiveSpeakingId(null);
      }
    },
    [activeSpeakingId, selectedLang, currentLangObj]
  );

  // Translate AND Speak Custom Text in Target Language (Kannada, Hindi, Marathi, etc.)
  const handleTranslateAndSpeak = useCallback(async () => {
    if (!customText.trim()) return;

    Vibration.vibrate([0, 30]);
    Speech.stop();
    setActiveSpeakingId(null);

    // If we already have the translation for the current language, speak it directly
    let textToSpeak = translatedText;
    if (!textToSpeak || translatedForLang !== selectedLang) {
      setIsTranslating(true);
      try {
        textToSpeak = await translationService.translateText(customText.trim(), selectedLang);
        setTranslatedText(textToSpeak);
        setTranslatedForLang(selectedLang);
      } catch (err) {
        console.warn('Translation failed, using raw text:', err);
        textToSpeak = customText.trim();
      } finally {
        setIsTranslating(false);
      }
    }

    if (!textToSpeak) return;

    setIsSpeakingCustom(true);
    try {
      Speech.speak(textToSpeak, {
        language: currentLangObj.speechCode,
        pitch: 1.0,
        rate: 0.82,
        onDone: () => setIsSpeakingCustom(false),
        onStopped: () => setIsSpeakingCustom(false),
        onError: () => setIsSpeakingCustom(false),
      });
    } catch (_) {
      setIsSpeakingCustom(false);
    }
  }, [customText, translatedText, translatedForLang, selectedLang, currentLangObj]);

  const handleStopAllSpeech = () => {
    Speech.stop();
    setActiveSpeakingId(null);
    setIsSpeakingCustom(false);
  };

  // Filter phrases
  const filteredPhrases = EMERGENCY_PHRASES.filter((p) => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Emergency Voice Board</Text>
            <View style={styles.liveVoiceBadge}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveVoiceBadgeText}>TTS Engine Active</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            1-Tap Local Audio & Large Screen Display
          </Text>
        </View>

        {(activeSpeakingId || isSpeakingCustom) && (
          <TouchableOpacity style={styles.stopAllBtn} onPress={handleStopAllSpeech}>
            <Ionicons name="stop" size={16} color={Colors.white} />
            <Text style={styles.stopAllBtnText}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroLeft}>
            <Ionicons name="megaphone" size={26} color="#38bdf8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Cannot speak the local language?</Text>
            <Text style={styles.heroDesc}>
              Tap <Text style={{ fontWeight: '700', color: Colors.white }}>Play Audio</Text> to speak clearly through your phone's speaker to police officers, doctors, or locals in Kannada, Hindi, or Marathi. Or type any custom sentence below to translate and speak!
            </Text>
          </View>
        </View>

        {/* Language Selection Tabs */}
        <Text style={styles.sectionHeader}>SELECT SPOKEN LANGUAGE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.langScroll}
          contentContainerStyle={styles.langScrollContent}
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selectedLang === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langChip, isSelected && styles.langChipSelected]}
                onPress={() => {
                  Vibration.vibrate(20);
                  Speech.stop();
                  setActiveSpeakingId(null);
                  setSelectedLang(lang.code);
                }}
              >
                <View style={styles.langChipTop}>
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <View style={[styles.langBadgeWrap, isSelected && styles.langBadgeWrapSelected]}>
                    <Text style={[styles.langBadgeText, isSelected && styles.langBadgeTextSelected]}>
                      {lang.badge}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.langNativeName, isSelected && styles.langNativeNameSelected]}>
                  {lang.nativeName}
                </Text>
                <Text style={styles.langSubName}>{lang.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 🗣️ Custom Speech Synthesizer & Real-Time Translator Input Card */}
        <View style={styles.customCard}>
          <View style={styles.customCardHeader}>
            <Ionicons name="language" size={18} color="#38bdf8" />
            <Text style={styles.customCardTitle}>Type in English → Speak in {currentLangObj.name}</Text>
          </View>
          <Text style={styles.customCardDesc}>
            Type any sentence in English. It will be automatically translated into {currentLangObj.name} ({currentLangObj.nativeName}) and spoken out loud through your speaker:
          </Text>

          <TextInput
            style={styles.customInput}
            value={customText}
            onChangeText={(txt) => {
              setCustomText(txt);
              if (!txt.trim()) {
                setTranslatedText('');
                setTranslatedForLang('');
              }
            }}
            placeholder="e.g. Please help me, take me to Udyambag Hospital..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={3}
          />

          {/* Action Buttons: Translate & Speak */}
          <View style={styles.customActions}>
            <TouchableOpacity
              style={[
                styles.customPlayBtn,
                (!customText.trim() || isSpeakingCustom || isTranslating) && styles.customPlayBtnActive,
              ]}
              onPress={isSpeakingCustom ? handleStopAllSpeech : handleTranslateAndSpeak}
              disabled={!customText.trim() || isTranslating}
            >
              {isTranslating ? (
                <>
                  <ActivityIndicator size="small" color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.customPlayBtnText}>Translating to {currentLangObj.nativeName}...</Text>
                </>
              ) : isSpeakingCustom ? (
                <>
                  <Ionicons name="stop" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.customPlayBtnText}>⏹️ Stop Audio</Text>
                </>
              ) : (
                <>
                  <Ionicons name="volume-high" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.customPlayBtnText}>
                    🗣️ Translate & Speak in {currentLangObj.nativeName} ({currentLangObj.name})
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {customText.length > 0 && (
              <TouchableOpacity
                style={styles.customClearBtn}
                onPress={() => {
                  setCustomText('');
                  setTranslatedText('');
                  setTranslatedForLang('');
                  Speech.stop();
                  setIsSpeakingCustom(false);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Live Translation Preview Result Box */}
          {translatedText && (
            <View style={styles.translationPreviewBox}>
              <View style={styles.previewHeaderRow}>
                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>
                    ✨ Translated into {currentLangObj.flag} {currentLangObj.nativeName} ({currentLangObj.name})
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.previewShowBigBtn}
                  onPress={() => setFullscreenData({
                    nativeText: translatedText,
                    english: customText,
                    langObj: currentLangObj,
                  })}
                >
                  <Ionicons name="expand" size={12} color="#38bdf8" />
                  <Text style={styles.previewShowBigText}>Show Big</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.previewNativeText}>{translatedText}</Text>
              <Text style={styles.previewEnglishText}>Original (English): "{customText}"</Text>

              <TouchableOpacity
                style={styles.previewSpeakBtn}
                onPress={isSpeakingCustom ? handleStopAllSpeech : handleTranslateAndSpeak}
              >
                <Ionicons
                  name={isSpeakingCustom ? 'pause-circle' : 'volume-high'}
                  size={16}
                  color={Colors.white}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.previewSpeakBtnText}>
                  {isSpeakingCustom ? 'Stop Audio' : `🔊 Play Audio Again in ${currentLangObj.nativeName}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Section Header for Pre-saved phrases */}
        <Text style={[styles.sectionHeader, { marginTop: 24, marginBottom: 10 }]}>
          OR 1-TAP PRE-SAVED EMERGENCY PHRASES
        </Text>

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {PHRASE_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                onPress={() => {
                  Vibration.vibrate(15);
                  setSelectedCategory(cat.id);
                }}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={isSelected ? Colors.white : Colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Phrases List */}
        <View style={styles.phrasesList}>
          {filteredPhrases.map((phrase) => {
            const trans = phrase.translations[selectedLang] || phrase.translations.en;
            const isPlaying = activeSpeakingId === phrase.id;

            return (
              <View
                key={phrase.id}
                style={[styles.phraseCard, isPlaying && styles.phraseCardPlaying]}
              >
                {/* Header row with Category icon & actions */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.categoryTag}>
                    <Ionicons name={phrase.icon} size={14} color="#38bdf8" />
                    <Text style={styles.categoryTagText}>
                      {phrase.category.toUpperCase()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.fullscreenBtn}
                    onPress={() => setFullscreenData({
                      nativeText: trans.text,
                      phonetic: trans.phonetic,
                      english: phrase.english,
                      langObj: currentLangObj,
                    })}
                  >
                    <Ionicons name="expand" size={14} color="#38bdf8" />
                    <Text style={styles.fullscreenBtnText}>Show Big</Text>
                  </TouchableOpacity>
                </View>

                {/* Main Large Native Text */}
                <Text style={styles.nativeText}>{trans.text}</Text>

                {/* Phonetic Pronunciation Guide */}
                {trans.phonetic && selectedLang !== 'en' && (
                  <View style={styles.phoneticBox}>
                    <Ionicons name="volume-medium-outline" size={13} color="#f59e0b" style={{ marginRight: 4 }} />
                    <Text style={styles.phoneticText} numberOfLines={2}>
                      Pronounce: "{trans.phonetic}"
                    </Text>
                  </View>
                )}

                {/* English Reference Meaning */}
                <Text style={styles.englishText}>
                  Meaning: {phrase.english}
                </Text>

                {/* Primary Audio Speaker Button */}
                <TouchableOpacity
                  style={[styles.playButton, isPlaying && styles.playButtonPlaying]}
                  onPress={() => handlePlayPhrase(phrase)}
                >
                  <Ionicons
                    name={isPlaying ? 'pause-circle' : 'volume-high'}
                    size={20}
                    color={Colors.white}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.playButtonText}>
                    {isPlaying
                      ? `Playing in ${currentLangObj.nativeName} (Tap to Stop)`
                      : `🔊 Play in ${currentLangObj.nativeName} (${currentLangObj.name})`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Fullscreen Big Text Modal for Responders */}
      {fullscreenData && (
        <Modal
          animationType="fade"
          transparent={false}
          visible={!!fullscreenData}
          onRequestClose={() => setFullscreenData(null)}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  Speech.stop();
                  setFullscreenData(null);
                }}
              >
                <Ionicons name="close" size={28} color={Colors.white} />
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>

              <View style={styles.modalLangBadge}>
                <Text style={styles.modalLangBadgeText}>
                  {fullscreenData.langObj.flag} {fullscreenData.langObj.nativeName} ({fullscreenData.langObj.name})
                </Text>
              </View>
            </View>

            {/* Giant Display Content */}
            <View style={styles.modalBody}>
              <Text style={styles.modalNotice}>
                👉 SHOW THIS SCREEN DIRECTLY TO THE POLICE OFFICER OR DOCTOR:
              </Text>

              <View style={styles.modalCard}>
                <Text style={styles.modalBigNativeText}>
                  {fullscreenData.nativeText}
                </Text>
              </View>

              {fullscreenData.phonetic && (
                <Text style={styles.modalPhonetic}>
                  Pronunciation: "{fullscreenData.phonetic}"
                </Text>
              )}

              {fullscreenData.english && (
                <Text style={styles.modalEnglish}>
                  English: {fullscreenData.english}
                </Text>
              )}

              {/* Giant Speak Button */}
              <TouchableOpacity
                style={styles.modalSpeakBtn}
                onPress={() => {
                  if (isSpeakingCustom) {
                    Speech.stop();
                    setIsSpeakingCustom(false);
                  } else {
                    Speech.stop();
                    setIsSpeakingCustom(true);
                    Speech.speak(fullscreenData.nativeText, {
                      language: fullscreenData.langObj.speechCode,
                      pitch: 1.0,
                      rate: 0.82,
                      onDone: () => setIsSpeakingCustom(false),
                      onStopped: () => setIsSpeakingCustom(false),
                      onError: () => setIsSpeakingCustom(false),
                    });
                  }
                }}
              >
                <Ionicons
                  name={isSpeakingCustom ? 'pause-circle' : 'volume-high'}
                  size={26}
                  color={Colors.white}
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.modalSpeakBtnText}>
                  {isSpeakingCustom
                    ? '⏹️ Stop Audio Playback'
                    : `🔊 Speak Out Loud in ${fullscreenData.langObj.name}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
  },
  liveVoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveVoiceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34d399',
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  stopAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stopAllBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  heroLeft: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 3,
  },
  heroDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  langScroll: {
    marginBottom: 14,
  },
  langScrollContent: {
    gap: 10,
  },
  langChip: {
    width: 140,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 10,
  },
  langChipSelected: {
    backgroundColor: 'rgba(14, 116, 144, 0.25)',
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  langChipTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  langFlag: {
    fontSize: 16,
  },
  langBadgeWrap: {
    backgroundColor: 'rgba(100, 116, 139, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  langBadgeWrapSelected: {
    backgroundColor: '#0284c7',
  },
  langBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
  },
  langBadgeTextSelected: {
    color: Colors.white,
  },
  langNativeName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  langNativeNameSelected: {
    color: '#38bdf8',
  },
  langSubName: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryScrollContent: {
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryChipSelected: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: Colors.white,
  },
  phrasesList: {
    gap: 14,
  },
  phraseCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
  },
  phraseCardPlaying: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(14, 116, 144, 0.15)',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  fullscreenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fullscreenBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  nativeText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 25,
    marginBottom: 8,
  },
  phoneticBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 8,
  },
  phoneticText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#fbbf24',
    flex: 1,
  },
  englishText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 10,
  },
  playButtonPlaying: {
    backgroundColor: '#dc2626',
  },
  playButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  customCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    marginBottom: 8,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  customCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  customCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  customCardDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 10,
    lineHeight: 16,
  },
  customInput: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    padding: 10,
    color: Colors.white,
    fontSize: 13,
    minHeight: 65,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  customActions: {
    flexDirection: 'row',
    gap: 8,
  },
  customPlayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 11,
    borderRadius: 8,
  },
  customPlayBtnActive: {
    backgroundColor: '#0369a1',
  },
  customPlayBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  customClearBtn: {
    width: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  translationPreviewBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
  },
  previewShowBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewShowBigText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
  },
  previewNativeText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
    lineHeight: 24,
    marginBottom: 4,
  },
  previewEnglishText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  previewSpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 8,
    borderRadius: 8,
  },
  previewSpeakBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  // Modal Fullscreen Big Text
  modalContainer: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  modalLangBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalLangBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  modalBody: {
    flex: 1,
    justifyContent: 'center',
  },
  modalNotice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.8,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: '#38bdf8',
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  modalBigNativeText: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.white,
    lineHeight: 38,
    textAlign: 'center',
  },
  modalPhonetic: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalEnglish: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalSpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
  },
  modalSpeakBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
});
