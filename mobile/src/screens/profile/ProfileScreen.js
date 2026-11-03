import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Colors from '../../theme/colors';
import { getStoredBaseUrl, setStoredBaseUrl } from '../../services/apiClient';
import { PUBLIC_TUNNEL_URL, USE_TUNNEL } from '../../config/api';
import emergencyService from '../../services/emergencyService';

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateProfile } = useAuth();

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Preferences
  const [locationSharing, setLocationSharing] = useState(
    user?.preferences?.locationSharing ?? true
  );
  const [shareWithPolice, setShareWithPolice] = useState(
    user?.preferences?.shareWithPolice ?? true
  );
  const [notifications, setNotifications] = useState(
    user?.preferences?.notifications ?? true
  );

  // New emergency contact fields
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [serverUrl, setServerUrl] = useState(USE_TUNNEL && PUBLIC_TUNNEL_URL ? PUBLIC_TUNNEL_URL : '');

  useEffect(() => {
    getStoredBaseUrl().then((url) => {
      setServerUrl(USE_TUNNEL && PUBLIC_TUNNEL_URL ? PUBLIC_TUNNEL_URL : url);
    });
    if (user?.name) setName(user.name);
    if (user?.phone) setPhone(user.phone);
  }, [user]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      Alert.alert('Profile Saved', 'Your personal details have been updated.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTogglePref = async (key, val) => {
    try {
      const newPrefs = {
        ...(user?.preferences || {}),
        [key]: val,
      };
      if (key === 'locationSharing') setLocationSharing(val);
      if (key === 'shareWithPolice') setShareWithPolice(val);
      if (key === 'notifications') setNotifications(val);

      await updateProfile({ preferences: newPrefs });
    } catch (e) {
      Alert.alert('Error', 'Failed to update preference on server.');
    }
  };

  const handleAddEmergencyContact = async () => {
    const cleanPhone = contactPhone.replace(/\D/g, '').slice(-10);
    if (!contactName.trim() || cleanPhone.length !== 10) {
      Alert.alert('Required', 'Please enter a contact name and valid 10-digit phone number.');
      return;
    }

    try {
      const current = Array.isArray(user?.emergencyContacts) ? user.emergencyContacts : [];
      const updated = [
        ...current,
        {
          name: contactName.trim(),
          phone: cleanPhone,
          relation: contactRelation.trim() || 'Family/Contact',
          relationship: contactRelation.trim() || 'Family/Contact',
        },
      ];

      await updateProfile({ emergencyContacts: updated });
      setContactName('');
      setContactPhone('');
      setContactRelation('');
      Alert.alert('Contact Added', 'New emergency contact is now linked to your Tourist ID.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not add emergency contact.');
    }
  };

  const handleRemoveContact = async (index) => {
    try {
      const updated = [...(Array.isArray(user?.emergencyContacts) ? user.emergencyContacts : [])];
      updated.splice(index, 1);
      await updateProfile({ emergencyContacts: updated });
    } catch (e) {
      Alert.alert('Error', 'Failed to remove contact.');
    }
  };

  const handleCallNumber = (num) => {
    if (!num) return;
    const clean = num.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${clean}`).catch(() => {
      Alert.alert('Unable to Dial', `Please call ${clean} from your phone.`);
    });
  };

  const handleSaveServerUrl = async () => {
    await setStoredBaseUrl(serverUrl);
    Alert.alert('Backend URL Saved', `Mobile app will now query: ${serverUrl}`);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out from this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {(user?.name || 'T').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileName}>{user?.name || 'Tourist User'}</Text>
        <Text style={styles.profileEmail}>{user?.email || 'guest@rakshasetu.local'}</Text>
        <View style={styles.idBadge}>
          <Ionicons name="card" size={12} color={Colors.primary} />
          <Text style={styles.idBadgeText}>ID: {user?.digitalId || 'VERIFIED'}</Text>
        </View>
      </View>

      {/* Edit Personal Profile Card */}
      <Text style={styles.sectionTitle}>Personal Details</Text>
      <View style={styles.card}>
        <Text style={styles.inputLabel}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Tourist Name"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.inputLabel}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+91 98765 43210"
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
        />

        <TouchableOpacity
          style={styles.saveProfileBtn}
          onPress={handleSaveProfile}
          disabled={savingProfile}
        >
          {savingProfile ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.saveProfileBtnText}>Update Profile Info</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Safety & Consent Preferences */}
      <Text style={styles.sectionTitle}>Safety & Location Consent</Text>
      <View style={styles.prefCard}>
        <View style={styles.prefRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefLabel}>Location Sharing</Text>
            <Text style={styles.prefSub}>Share live coordinates with Safety System</Text>
          </View>
          <Switch
            value={locationSharing}
            onValueChange={(val) => handleTogglePref('locationSharing', val)}
            trackColor={{ true: Colors.primary }}
          />
        </View>

        <View style={styles.prefRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefLabel}>Share with Police / Responders</Text>
            <Text style={styles.prefSub}>Allow verified police officers to track location during SOS</Text>
          </View>
          <Switch
            value={shareWithPolice}
            onValueChange={(val) => handleTogglePref('shareWithPolice', val)}
            trackColor={{ true: Colors.primary }}
          />
        </View>

        <View style={[styles.prefRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefLabel}>Push Alerts & Advisories</Text>
            <Text style={styles.prefSub}>Receive perimeter breach warnings and safety notices</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={(val) => handleTogglePref('notifications', val)}
            trackColor={{ true: Colors.primary }}
          />
        </View>
      </View>

      {/* Emergency Contacts Manager with Direct Quick-Dial */}
      <Text style={styles.sectionTitle}>Emergency Contacts</Text>
      <View style={styles.card}>
        {/* Always available 112 */}
        <View style={styles.contactItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactName}>National Emergency Helpline</Text>
            <Text style={styles.contactPhone}>112 (Police, Fire, Ambulance)</Text>
          </View>
          <TouchableOpacity
            style={styles.callContactBtnDanger}
            onPress={() => emergencyService.callEmergencyHelpline('112')}
          >
            <Ionicons name="call" size={13} color={Colors.white} />
            <Text style={styles.callContactBtnText}>112</Text>
          </TouchableOpacity>
        </View>

        {Array.isArray(user?.emergencyContacts) && user.emergencyContacts.length > 0 ? (
          user.emergencyContacts.map((c, i) => (
            <View key={i} style={styles.contactItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c?.name || 'Contact'}</Text>
                <Text style={styles.contactPhone}>
                  {c?.phone} {c?.relation ? `(${c.relation})` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={styles.callContactBtn}
                  onPress={() => handleCallNumber(c?.phone)}
                >
                  <Ionicons name="call" size={12} color={Colors.white} />
                  <Text style={styles.callContactBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveContact(i)}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noContactsText}>No personal emergency contacts added yet.</Text>
        )}

        <Text style={styles.addContactTitle}>Add New Contact</Text>
        <TextInput
          style={styles.input}
          placeholder="Contact Name (e.g. Brother, Friend)"
          placeholderTextColor={Colors.textMuted}
          value={contactName}
          onChangeText={setContactName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number (+91 ...)"
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
          value={contactPhone}
          onChangeText={setContactPhone}
        />
        <TextInput
          style={styles.input}
          placeholder="Relationship (e.g. Spouse, Father, Guide)"
          placeholderTextColor={Colors.textMuted}
          value={contactRelation}
          onChangeText={setContactRelation}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAddEmergencyContact}>
          <Text style={styles.addBtnText}>Save Contact</Text>
        </TouchableOpacity>
      </View>

      {/* Developer / LAN Connection URL */}
      <Text style={styles.sectionTitle}>Network Server Connection</Text>
      <View style={styles.card}>
        <Text style={styles.serverHint}>
          When testing on a physical phone via Expo Go, set this to your computer's LAN IP:
        </Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.x.x:5001"
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity style={styles.saveServerBtn} onPress={handleSaveServerUrl}>
          <Text style={styles.saveServerText}>Update API Host</Text>
        </TouchableOpacity>
      </View>

      {/* Safety & Customer Support Navigation */}
      <Text style={styles.sectionTitle}>Help & Support</Text>
      <TouchableOpacity
        style={styles.supportNavBtn}
        onPress={() => navigation.navigate('Home', { screen: 'SupportScreen' })}
      >
        <View style={styles.supportNavIcon}>
          <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.supportNavTitle}>Safety & Customer Support</Text>
          <Text style={styles.supportNavSub}>Open inquiry tickets, view replies & FAQs</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.logoutText}>Sign Out from RakshaSetu</Text>
      </TouchableOpacity>

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
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLetter: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  idBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
    marginTop: 14,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  saveProfileBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  saveProfileBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  prefCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  prefLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  prefSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
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
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  callContactBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  callContactBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  noContactsText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  addContactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  serverHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
  },
  saveServerBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveServerText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 13,
    gap: 8,
    marginTop: 14,
  },
  logoutText: {
    color: Colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  supportNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    gap: 12,
  },
  supportNavIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportNavTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  supportNavSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
