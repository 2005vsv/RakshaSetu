import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Colors from '../../theme/colors';
import { getDefaultBaseUrl } from '../../config/api';

export default function DigitalIdScreen() {
  const { user, refreshUser } = useAuth();
  const [openingBrowser, setOpeningBrowser] = useState(false);

  useEffect(() => {
    if (!user?.digitalId && typeof refreshUser === 'function') {
      refreshUser().catch(() => {});
    }
  }, [user?.digitalId, refreshUser]);

  const baseUrl = getDefaultBaseUrl();
  const digitalId = user?.digitalId || 'DIG-DEMO-8D3857';
  const verificationUrl = `${baseUrl}/verify/${encodeURIComponent(digitalId)}`;

  const handleOpenLivePass = async () => {
    try {
      setOpeningBrowser(true);
      const supported = await Linking.canOpenURL(verificationUrl);
      if (supported) {
        await Linking.openURL(verificationUrl);
      } else {
        Alert.alert('Verification URL', verificationUrl);
      }
    } catch (e) {
      Alert.alert('Unable to Open Browser', verificationUrl);
    } finally {
      setOpeningBrowser(false);
    }
  };

  const handleShareId = async () => {
    try {
      await Share.share({
        title: 'RakshaSetu Tourist Safety Pass',
        message: `🛡️ Government Verified Tourist Safety Pass\n\nTourist: ${user?.name || 'Authorized Tourist'}\nDigital ID: ${digitalId}\nStatus: Active Verified\nNational Helpline: 112\n\nVerify official credentials online:\n${verificationUrl}`,
        url: verificationUrl,
      });
    } catch (e) {
      Alert.alert('Share Error', e.message);
    }
  };

  const handleCallNumber = (phone) => {
    if (!phone) return;
    const clean = phone.replace(/[^\d+]/g, '');
    if (!clean) {
      Alert.alert('Invalid Number', 'No valid phone number found.');
      return;
    }
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Unable to Dial', `Please call ${clean} from your phone.`);
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.headerTitle}>Digital Tourist ID</Text>
      <Text style={styles.headerSubtitle}>
        Government verified safety credential & checkpost pass
      </Text>

      {/* Physical-style Pass Card */}
      <View style={styles.idCard}>
        {/* Top Card Band */}
        <View style={styles.cardTopBand}>
          <View style={styles.emblemIcon}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.white} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.govTitle}>MINISTRY OF TOURISM · INDIA</Text>
            <Text style={styles.govSub}>SMART TOURIST SAFETY NETWORK</Text>
          </View>
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activePillText}>ACTIVE</Text>
          </View>
        </View>

        {/* Card Body with QR Code */}
        <View style={styles.cardBody}>
          <View style={styles.qrContainer}>
            <QRCode
              value={verificationUrl}
              size={120}
              color="#000000"
              backgroundColor="#ffffff"
            />
            <Text style={styles.qrScanHint}>Scan with any camera</Text>
          </View>

          <View style={styles.idInfoBlock}>
            <Text style={styles.infoLabel}>TOURIST NAME</Text>
            <Text style={styles.infoValueName} numberOfLines={1}>
              {user?.name || 'Authorized Tourist'}
            </Text>

            <Text style={styles.infoLabel}>DIGITAL IDENTIFIER</Text>
            <Text style={styles.infoValueId} numberOfLines={1}>
              {digitalId}
            </Text>

            <Text style={styles.infoLabel}>PHONE</Text>
            <Text style={styles.infoValue}>
              {user?.phone ? `${String(user.phone).slice(0, 2)}******${String(user.phone).slice(-4)}` : 'Verified on file'}
            </Text>

            <Text style={styles.infoLabel}>STATUS / ISSUER</Text>
            <Text style={styles.infoValueStatus}>
              Active · RakshaSetu Cell
            </Text>
          </View>
        </View>

        {/* Live URL Pill Inside Card */}
        <TouchableOpacity
          style={styles.cardUrlRow}
          onPress={handleOpenLivePass}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={13} color={Colors.primary} />
          <Text style={styles.cardUrlText} numberOfLines={1}>
            {verificationUrl}
          </Text>
          <Ionicons name="open-outline" size={13} color={Colors.primary} />
        </TouchableOpacity>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerRow}>
            <Ionicons name="lock-closed" size={12} color="#64748b" />
            <Text style={styles.footerText}>
              Cryptographically signed by RakshaSetu Security Engine
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={handleOpenLivePass}
          disabled={openingBrowser}
          activeOpacity={0.8}
        >
          {openingBrowser ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="open-outline" size={16} color={Colors.white} />
              <Text style={styles.actionBtnText}>Preview Live Pass</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={handleShareId}
          activeOpacity={0.8}
        >
          <Ionicons name="share-social-outline" size={16} color={Colors.white} />
          <Text style={styles.actionBtnText}>Share / Save Pass</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Contact on File with direct Call */}
      <View style={styles.contactCard}>
        <View style={styles.contactHeader}>
          <Ionicons name="people" size={18} color={Colors.primary} />
          <Text style={styles.contactTitle}>Emergency Contacts on Record</Text>
        </View>
        {Array.isArray(user?.emergencyContacts) && user.emergencyContacts.length > 0 ? (
          user.emergencyContacts.map((c, idx) => (
            <View key={idx} style={styles.contactItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c?.name || 'Emergency Contact'}</Text>
                <Text style={styles.contactPhone}>
                  {c?.phone} {c?.relation ? `(${c.relation})` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.callContactBtn}
                onPress={() => handleCallNumber(c?.phone)}
              >
                <Ionicons name="call" size={12} color={Colors.white} />
                <Text style={styles.callContactBtnText}>Call</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.noContacts}>
            No emergency contacts saved. Add them in your Profile tab to auto-link to your ID.
          </Text>
        )}
      </View>

      {/* Verification Instructions */}
      <View style={styles.infoBox}>
        <Ionicons name="shield-checkmark-outline" size={20} color={Colors.accentGold} />
        <Text style={styles.infoText}>
          Present this QR pass to verified police officers, tourist helpdesks, and national park checkpoints. Scanning with any smartphone camera instantly verifies your active credential on the national network without revealing sensitive personal details.
        </Text>
      </View>
      <View style={{ height: 25 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 16,
  },
  idCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 14,
  },
  cardTopBand: {
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emblemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  govTitle: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  govSub: {
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  activePillText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 14,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  qrScanHint: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  idInfoBlock: {
    flex: 1,
    paddingLeft: 14,
  },
  infoLabel: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  infoValueName: {
    fontSize: 14.5,
    color: '#0f172a',
    fontWeight: '800',
  },
  infoValueId: {
    fontSize: 11.5,
    color: Colors.primary,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoValue: {
    fontSize: 11,
    color: '#1e293b',
    fontWeight: '600',
  },
  infoValueStatus: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: '700',
  },
  cardUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  cardUrlText: {
    flex: 1,
    fontSize: 10.5,
    color: Colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  cardFooter: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '500',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  actionBtnSecondary: {
    backgroundColor: '#334155',
  },
  actionBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 12.5,
  },
  contactCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  contactName: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  callContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  callContactBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  noContacts: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
});
