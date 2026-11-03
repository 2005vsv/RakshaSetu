import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Linking,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../theme/colors';
import apiClient from '../../services/apiClient';
import socketService from '../../services/socketService';
import { API_ENDPOINTS } from '../../config/api';

const CATEGORIES = [
  { key: 'technical', label: 'Technical Issue', icon: 'construct' },
  { key: 'account', label: 'Account Access', icon: 'person' },
  { key: 'privacy', label: 'Privacy & Data', icon: 'shield-checkmark' },
  { key: 'other', label: 'General Help', icon: 'chatbubbles' },
];

const dedupeTickets = (list) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (!item) continue;
    const id = String(item._id || item.id || '');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    result.push(item);
  }
  return result;
};

export default function SupportScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' | 'faq'
  const [supportRequests, setSupportRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form inputs
  const [category, setCategory] = useState('technical');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const fetchSupportRequests = useCallback(async () => {
    try {
      const res = await apiClient.get(API_ENDPOINTS.SUPPORT);
      const list = Array.isArray(res?.data) ? res.data : [];
      setSupportRequests(dedupeTickets(list));
    } catch (e) {
      console.warn('Support fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSupportRequests();

    // Listen to real-time response from admin
    const unsubUpdate = socketService.on('support:updated', (updated) => {
      if (updated) {
        const upId = String(updated._id || updated.id || '');
        setSupportRequests((prev) => {
          const exists = (prev || []).some((item) => String(item._id || item.id || '') === upId);
          if (exists) {
            return (prev || []).map((item) =>
              String(item._id || item.id || '') === upId ? { ...item, ...updated } : item
            );
          }
          return dedupeTickets([updated, ...(prev || [])]);
        });
        Vibration.vibrate(300);
      }
    });

    return () => {
      unsubUpdate();
    };
  }, [fetchSupportRequests]);

  const handleSubmit = async () => {
    const cleanSubject = subject.trim();
    const cleanMsg = message.trim();

    if (cleanSubject.length < 3) {
      Alert.alert('Subject Required', 'Please enter a subject of at least 3 characters.');
      return;
    }
    if (cleanMsg.length < 10) {
      Alert.alert('Message Required', 'Please explain your inquiry in at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post(API_ENDPOINTS.SUPPORT, {
        category,
        subject: cleanSubject,
        message: cleanMsg,
      });

      const newTicket = res.data;
      setSupportRequests((prev) => dedupeTickets([newTicket, ...(prev || [])]));
      setSubject('');
      setMessage('');
      Vibration.vibrate(200);

      Alert.alert(
        'Request Sent!',
        `Support ticket #${(newTicket._id || 'NEW').slice(-6).toUpperCase()} has been submitted. An administrator will review your message.`
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to submit support request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (st) => {
    switch (st) {
      case 'closed':
        return Colors.success;
      case 'in_review':
        return Colors.primary;
      default:
        return Colors.warning;
    }
  };

  const faqs = [
    {
      q: 'Does sending a support message trigger an emergency dispatch?',
      a: 'No. Support tickets are for non-emergency inquiries and are reviewed during operational hours. For live emergency distress, please tap the SOS tab or dial 112 immediately.',
    },
    {
      q: 'How does live location sharing work?',
      a: 'When Location Sharing and Share with Police are enabled in your Profile, your GPS coordinates are securely monitored so emergency teams can dispatch aid if you leave safe zones or activate SOS.',
    },
    {
      q: 'Can I cancel an accidental SOS alert?',
      a: 'Yes. On the SOS tab, tap "I Am Safe (Cancel SOS)" to resolve the incident and notify emergency operators that you are safe.',
    },
    {
      q: 'Where do I find my digital Tourist ID pass?',
      a: 'Tap the "ID Pass" tab in the bottom bar to view your government verified Tourist ID badge and scannable QR verification code.',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Safety & Customer Support</Text>
          <Text style={styles.headerSub}>Help Center & Live Monitoring Inquiries</Text>
        </View>
      </View>

      {/* Segmented Tab Controls */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'tickets' && styles.tabBtnActive]}
          onPress={() => setActiveTab('tickets')}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={16}
            color={activeTab === 'tickets' ? Colors.white : Colors.textSecondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'tickets' && styles.tabBtnTextActive]}>
            Contact Support ({supportRequests.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'faq' && styles.tabBtnActive]}
          onPress={() => setActiveTab('faq')}
        >
          <Ionicons
            name="book"
            size={16}
            color={activeTab === 'faq' ? Colors.white : Colors.textSecondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'faq' && styles.tabBtnTextActive]}>
            Safety Info & FAQs
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchSupportRequests();
            }}
            tintColor={Colors.primary}
          />
        }
      >
        {activeTab === 'tickets' ? (
          <>
            {/* New Support Request Form */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="create-outline" size={20} color={Colors.primary} />
                <Text style={styles.cardTitle}>Submit a Support Inquiry</Text>
              </View>
              <Text style={styles.cardDesc}>
                Messages are routed to the central administrator control room.
              </Text>

              {/* Category Pills */}
              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => {
                  const isSel = category === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.catPill, isSel && styles.catPillActive]}
                      onPress={() => setCategory(cat.key)}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={14}
                        color={isSel ? Colors.white : Colors.textSecondary}
                      />
                      <Text style={[styles.catPillText, isSel && styles.catPillTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Subject */}
              <Text style={styles.inputLabel}>Subject</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Inquiry about restricted zones or ID"
                placeholderTextColor={Colors.textMuted}
                value={subject}
                onChangeText={setSubject}
                maxLength={160}
              />

              {/* Message */}
              <Text style={styles.inputLabel}>Detailed Message</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe your inquiry or technical issue here (min 10 characters)..."
                placeholderTextColor={Colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                maxLength={3000}
                textAlignVertical="top"
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color={Colors.white} />
                    <Text style={styles.submitBtnText}>Submit Support Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Past Inquiries List */}
            <Text style={styles.sectionHeader}>Your Support Inbox</Text>

            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : supportRequests.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="mail-open-outline" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Inquiries Yet</Text>
                <Text style={styles.emptySub}>
                  When you submit a support question, your conversation and official operator replies will appear here.
                </Text>
              </View>
            ) : (
              supportRequests.map((req, index) => {
                const statusColor = getStatusColor(req.status);
                const ticketKey = `ticket-${req._id || req.id || 'sup'}-${index}`;
                return (
                  <View key={ticketKey} style={styles.ticketCard}>
                    <View style={styles.ticketHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ticketSubject}>{req.subject}</Text>
                        <Text style={styles.ticketMeta}>
                          {req.category?.toUpperCase()} · {new Date(req.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: `${statusColor}18` }]}>
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                          {(req.status || 'open').replace(/_/g, ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Tourist message */}
                    <View style={styles.touristMessageBox}>
                      <Text style={styles.touristMessageText}>{req.message}</Text>
                    </View>

                    {/* Operator response */}
                    {req.response ? (
                      <View style={styles.responseBox}>
                        <View style={styles.responseHeader}>
                          <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
                          <Text style={styles.responseAuthor}>Operator / Admin Response</Text>
                        </View>
                        <Text style={styles.responseText}>{req.response}</Text>
                      </View>
                    ) : (
                      <View style={styles.pendingBox}>
                        <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                        <Text style={styles.pendingText}>Awaiting administrator review</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        ) : (
          /* Safety Info & FAQs Tab */
          <>
            {/* Quick Emergency Helplines */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="call" size={20} color={Colors.danger} />
                <Text style={styles.cardTitle}>Immediate Emergency Contacts</Text>
              </View>
              <Text style={styles.cardDesc}>
                If you are in immediate danger, dial directly:
              </Text>

              <View style={styles.helplineList}>
                <TouchableOpacity
                  style={styles.helplineItem}
                  onPress={() => Linking.openURL('tel:112')}
                >
                  <View style={[styles.helplineIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name="call" size={18} color={Colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.helplineName}>112 National Police & Emergency</Text>
                    <Text style={styles.helplineSub}>All-India emergency dispatch helpline</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.helplineItem}
                  onPress={() => Linking.openURL('tel:1363')}
                >
                  <View style={[styles.helplineIconWrap, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
                    <Ionicons name="airplane" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.helplineName}>1363 Ministry of Tourism</Text>
                    <Text style={styles.helplineSub}>Multi-language tourist assistance</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.helplineItem}
                  onPress={() => Linking.openURL('tel:1090')}
                >
                  <View style={[styles.helplineIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                    <Ionicons name="woman" size={18} color={Colors.accentGold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.helplineName}>1090 Women Helpline</Text>
                    <Text style={styles.helplineSub}>24x7 Women safety & protection helpline</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Travel Safety Checklist */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="checkbox-outline" size={20} color={Colors.success} />
                <Text style={styles.cardTitle}>Travel Safety Checklist</Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.checkText}>Keep your emergency contacts updated in your Profile.</Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.checkText}>Enable Location Sharing when traversing new or remote areas.</Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.checkText}>Inspect the Safety Radar map to avoid restricted red zones.</Text>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.checkText}>Carry your verifiable Digital ID Pass QR code.</Text>
              </View>
            </View>

            {/* Expandable FAQs */}
            <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>
            {faqs.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <TouchableOpacity
                  key={`faq-${index}`}
                  style={styles.faqCard}
                  activeOpacity={0.8}
                  onPress={() => setExpandedFaq(isOpen ? null : index)}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{faq.q}</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={Colors.primary}
                    />
                  </View>
                  {isOpen && <Text style={styles.faqAnswer}>{faq.a}</Text>}
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
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
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabBtnTextActive: {
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catPillText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  catPillTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    color: Colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 90,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    marginTop: 6,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  ticketCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  ticketMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  touristMessageBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  touristMessageText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  responseBox: {
    marginTop: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    padding: 10,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  responseAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  responseText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  pendingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  helplineList: {
    gap: 10,
    marginTop: 4,
  },
  helplineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  helplineIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helplineName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  helplineSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  checkText: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  faqCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  faqAnswer: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});

