import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';
import updateService from '../services/updateService';

export default function UpdateModal() {
  const [visible, setVisible] = useState(false);
  const [updateData, setUpdateData] = useState(null);

  useEffect(() => {
    // 1. Subscribe to update service events (both startup check & realtime broadcasts)
    const unsubscribe = updateService.subscribe((info) => {
      if (info && info.latestVersion) {
        setUpdateData(info);
        setVisible(true);
      }
    });

    // 2. Perform startup check after a brief 2-second delay so app UI settles
    const timer = setTimeout(() => {
      updateService.checkForUpdates();
    }, 2000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  if (!visible || !updateData) return null;

  const handleUpdatePress = () => {
    updateService.startUpdate(updateData.downloadUrl);
    if (!updateData.forceUpdate) {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  const notes = Array.isArray(updateData.releaseNotes)
    ? updateData.releaseNotes
    : [
        '⌨️ Password & form keyboard scrolling improvements',
        '🗺️ Live place search suggestions for travel routes',
        '📱 Android 3-button navigation bar clearance',
        '🤖 Enhanced Raksha AI with math & general knowledge',
        '📴 Direct emergency contact offline SMS beacon',
      ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Badge */}
          <View style={styles.iconCircle}>
            <Ionicons name="rocket" size={32} color="#38bdf8" />
          </View>

          <Text style={styles.title}>Update Available!</Text>
          <Text style={styles.subtitle}>
            A new version of <Text style={{ color: '#38bdf8', fontWeight: '700' }}>RakshaSetu</Text> is ready to install.
          </Text>

          {/* Version Pills */}
          <View style={styles.versionRow}>
            <View style={styles.versionBadgeNew}>
              <Text style={styles.versionBadgeNewText}>v{updateData.latestVersion} (Latest)</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={Colors.textSecondary} style={{ marginHorizontal: 6 }} />
            <View style={styles.versionBadgeCurrent}>
              <Text style={styles.versionBadgeCurrentText}>v{updateData.currentVersion || '1.0.0'} (Current)</Text>
            </View>
          </View>

          {/* Release Notes */}
          <View style={styles.notesBox}>
            <Text style={styles.notesHeader}>What's New in this Version:</Text>
            <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
              {notes.map((note, idx) => (
                <View key={idx} style={styles.noteItem}>
                  <Text style={styles.noteBullet}>•</Text>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            {!updateData.forceUpdate && (
              <TouchableOpacity style={styles.laterBtn} onPress={handleDismiss} activeOpacity={0.8}>
                <Text style={styles.laterBtnText}>Later</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.updateBtn} onPress={handleUpdatePress} activeOpacity={0.85}>
              <Ionicons name="download-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.updateBtnText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    alignItems: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 14,
  },
  versionBadgeNew: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionBadgeNewText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  versionBadgeCurrent: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionBadgeCurrentText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  notesBox: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  notesHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  noteBullet: {
    color: '#38bdf8',
    fontSize: 14,
    marginRight: 6,
    lineHeight: 16,
  },
  noteText: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  laterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  updateBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  updateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
