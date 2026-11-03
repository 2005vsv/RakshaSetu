import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import Colors from '../../theme/colors';

export default function RegisterScreen({ navigation }) {
  const { register, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [password, setPassword] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const handleRegister = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');

    if (!cleanName || !cleanEmail || !password.trim()) {
      Alert.alert('Required Fields', 'Full name, email, and password are required.');
      return;
    }

    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Password Policy', 'Password must contain at least 8 characters.');
      return;
    }

    if (cleanAadhaar && cleanAadhaar.length !== 12) {
      Alert.alert('Invalid Aadhaar', 'Aadhaar / National ID must contain exactly 12 digits (or leave blank).');
      return;
    }

    // Backend requires at least one emergency contact with name, phone, and relation
    const cleanEmergencyPhone = emergencyPhone.replace(/\D/g, '').slice(-10);
    const emergencyContacts = [
      {
        name: emergencyName.trim() || 'Emergency Contact',
        phone: cleanEmergencyPhone.length === 10 ? cleanEmergencyPhone : cleanPhone,
        relation: 'Family/Guardian',
        relationship: 'Family/Guardian',
      },
    ];

    try {
      await register({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        aadhaarNumber: cleanAadhaar || undefined,
        password,
        emergencyContacts,
        touristRole: 'tourist',
      });

      Alert.alert('Registration Successful', 'Your verified Digital Tourist ID has been issued.');
    } catch (err) {
      Alert.alert('Registration Failed', err.message || 'Could not register tourist account.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tourist Registration</Text>
        </View>

        <Text style={styles.infoBanner}>
          Create your verified tourist profile to enable real-time tracking, digital ID verification, and priority SOS response.
        </Text>

        <View style={styles.sectionHeader}>
          <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Identity Details</Text>
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Full Name (as per ID)"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Mobile Phone (10 digits, e.g. 9876543210)"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Aadhaar / National ID (12 digits, optional)"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            maxLength={12}
            value={aadhaarNumber}
            onChangeText={setAadhaarNumber}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Account Password (min. 8 characters)"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={[styles.sectionHeader, { marginTop: 16 }]}>
          <Ionicons name="call-outline" size={20} color={Colors.danger} />
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Contact Name (Family / Guardian)"
            placeholderTextColor={Colors.textMuted}
            value={emergencyName}
            onChangeText={setEmergencyName}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Contact Phone Number (10 digits)"
            placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad"
            maxLength={10}
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>Generate Digital Tourist ID</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    marginRight: 14,
    padding: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  infoBanner: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 20,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  inputGroup: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
    justifyContent: 'center',
  },
  input: {
    color: Colors.text,
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
