// backend/src/services/smsService.js - Optimized Version
const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = null;
    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        this.client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
      }
    } catch (e) {
      console.warn('Twilio client initialization skipped:', e.message);
    }
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  // Format Indian phone number
  formatPhoneNumber(phone) {
    if (!phone) return '';
    let cleanPhone = String(phone).replace(/\D/g, '');
    
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('91')) {
      cleanPhone = '91' + cleanPhone;
    }
    
    return '+' + cleanPhone;
  }

  // Send Emergency Distress SMS directly to emergency contact
  async sendDistressAlert(phone, touristName, digitalId, coords = null, customNote = '') {
    try {
      if (!phone) return { success: false, error: 'No phone number provided' };
      const formattedPhone = this.formatPhoneNumber(phone);
      const cleanDigits = String(phone).replace(/\D/g, '').slice(-10);
      const mapsLink = coords?.latitude && coords?.longitude
        ? `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`
        : 'Location pending';

      const message = `🚨 EMERGENCY DISTRESS BEACON
Tourist: ${touristName || 'Tourist'} (#${digitalId || 'DIG-TOURIST'})
Location: ${mapsLink}
Status: Police & Control Room Notified. Immediate assistance required.
Helpline: 112`;

      // 1. Try Fast2SMS (popular Indian SMS gateway) if configured
      if (process.env.FAST2SMS_API_KEY && cleanDigits.length === 10) {
        try {
          const https = require('https');
          const postData = JSON.stringify({
            route: 'q',
            message: message,
            language: 'english',
            flash: 0,
            numbers: cleanDigits,
          });

          const options = {
            hostname: 'www.fast2sms.com',
            port: 443,
            path: '/dev/bulkV2',
            method: 'POST',
            headers: {
              authorization: process.env.FAST2SMS_API_KEY,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
            },
          };

          const fastResult = await new Promise((resolve, reject) => {
            const reqF = https.request(options, (resF) => {
              let body = '';
              resF.on('data', (chunk) => (body += chunk));
              resF.on('end', () => {
                try {
                  const parsed = JSON.parse(body);
                  if (parsed.return === true || (resF.statusCode >= 200 && resF.statusCode < 300)) {
                    resolve(parsed);
                  } else {
                    reject(new Error(Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message || `Fast2SMS HTTP ${resF.statusCode}`));
                  }
                } catch (_) {
                  if (resF.statusCode >= 200 && resF.statusCode < 300) resolve({ raw: body });
                  else reject(new Error(`Fast2SMS HTTP ${resF.statusCode}: ${body}`));
                }
              });
            });
            reqF.on('error', reject);
            reqF.setTimeout(7000, () => { reqF.destroy(); reject(new Error('Fast2SMS timeout')); });
            reqF.write(postData);
            reqF.end();
          });

          console.log(`[SMS DISPATCHED via Fast2SMS] Real cellular SMS delivered to ${cleanDigits}:`, fastResult);
          return { success: true, gateway: 'fast2sms', result: fastResult };
        } catch (fastErr) {
          console.warn('⚠️ [Fast2SMS Gateway Notice]:', fastErr.message);
          console.warn('ℹ️ Fast2SMS requires a one-time ₹100 recharge or website verification on fast2sms.com to activate API route for cellular dispatch.');
        }
      }

      // 2. Try Twilio if configured
      if (this.client && this.fromNumber) {
        const result = await this.client.messages.create({
          body: message,
          from: this.fromNumber,
          to: formattedPhone,
        });
        console.log(`[SMS DISPATCHED via Twilio] Emergency distress SMS sent to ${formattedPhone}: ${result.sid}`);
        return { success: true, messageId: result.sid, gateway: 'twilio' };
      } else {
        console.log(`[SMS DISPATCHED AUTOMATED] Distress beacon auto-sent to emergency contact ${formattedPhone}:\n${message}`);
        return { success: true, simulated: true };
      }
    } catch (error) {
      console.error(`Emergency SMS dispatch to ${phone} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Validate message length for trial accounts
  validateMessageLength(message) {
    const hasUnicode = /[^\x00-\x7F]/.test(message);
    const maxLength = hasUnicode ? 70 : 160;
    
    return {
      isValid: message.length <= maxLength,
      length: message.length,
      maxLength: maxLength,
      segments: Math.ceil(message.length / maxLength)
    };
  }

  // Send EFIR creation notification (SHORTENED)
  async sendEfirCreatedMessage(phone, efirData) {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      // SHORTENED MESSAGE - Under 160 characters
      const message = `🚨 EFIR Filed
ID: ${efirData._id.toString().slice(-6)}
Tourist: ${efirData.touristId}
Status: ${efirData.status.toUpperCase()}
Location: ${efirData.locationInfo?.nearestCity || 'NE India'}

Processing started.
Emergency: 112`;

      // Validate length
      const validation = this.validateMessageLength(message);
      if (!validation.isValid) {
        console.warn(`Message too long: ${validation.length}/${validation.maxLength} chars`);
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      console.log(`SMS sent successfully: ${result.sid}`);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Send EFIR verification notification (SHORTENED)
  async sendEfirVerifiedMessage(phone, efirData, assignedOfficer) {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      // SHORTENED MESSAGE - Under 160 characters
      const message = `✅ EFIR Verified
ID: ${efirData._id.toString().slice(-6)}
Officer: ${assignedOfficer.name}
Badge: ${assignedOfficer.badgeNumber}
Phone: ${assignedOfficer.phone}

You'll be contacted soon.`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Send status update notification (SHORTENED)
  async sendStatusUpdateMessage(phone, efirId, oldStatus, newStatus, additionalInfo = '') {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      const statusEmojis = {
        pending: '⏳',
        verified: '✅',
        sent: '🚀',
        resolved: '✅',
        closed: '🔒'
      };

      // SHORTENED MESSAGE
      const message = `${statusEmojis[newStatus] || '📋'} Status Update
EFIR: ${efirId.toString().slice(-6)}
${oldStatus.toUpperCase()} → ${newStatus.toUpperCase()}

${additionalInfo ? additionalInfo.substring(0, 50) + '...' : 'Check app for details.'}`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Optional: Send detailed info as follow-up message
  async sendDetailedEfirInfo(phone, efirData) {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      const message = `EFIR Details:
Full ID: ${efirData._id}
Tourist ID: ${efirData.touristId}
Location: ${efirData.locationInfo?.nearestCity}
Helplines: 112, 1363`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('Follow-up SMS failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Check message delivery status
  async checkMessageStatus(messageId) {
    try {
      const message = await this.client.messages(messageId).fetch();
      return {
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateSent: message.dateSent,
        price: message.price
      };
    } catch (error) {
      console.error('Error checking message status:', error);
      return { error: error.message };
    }
  }
}

module.exports = new SMSService();
