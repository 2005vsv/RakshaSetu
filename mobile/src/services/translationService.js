/**
 * Translation Service for RakshaSetu Tourist Safety App
 * Translates English tourist sentences into local Indian state languages:
 * - kn: Kannada (Karnataka / Belagavi)
 * - hi: Hindi (National)
 * - mr: Marathi (Regional Border)
 * - en: English
 *
 * Utilizes high-speed translation with an offline fallback dictionary.
 */

class TranslationService {
  constructor() {
    // Offline emergency dictionary for zero-network resilience
    this.offlineDictionary = [
      {
        patterns: [/lost/i, /where am i/i, /rasta/i],
        translations: {
          kn: 'ನಾನು ದಾರಿ ತಪ್ಪಿದ್ದೇನೆ, ದಯವಿಟ್ಟು ನನಗೆ ಸಹಾಯ ಮಾಡಿ.',
          hi: 'मैं रास्ता भटक गया हूँ, कृपया मेरी मदद करें।',
          mr: 'मी रस्ता चुकलो आहे, कृपया मला मदत करा.',
        },
      },
      {
        patterns: [/doctor/i, /hospital/i, /ambulance/i, /medical/i, /sick/i, /injured/i],
        translations: {
          kn: 'ನನಗೆ ತಕ್ಷಣ ವೈದ್ಯಕೀಯ ಚಿಕಿತ್ಸೆ ಬೇಕು, ದಯವಿಟ್ಟು ಆಸ್ಪತ್ರೆಗೆ ಕರೆದುಕೊಂಡು ಹೋಗಿ.',
          hi: 'मुझे तुरंत डॉक्टर की जरूरत है, कृपया अस्पताल ले चलें।',
          mr: 'मला तातडीने डॉक्टरची गरज आहे, कृपया रुग्णालयात घेऊन चला.',
        },
      },
      {
        patterns: [/police/i, /theft/i, /stolen/i, /thief/i, /snatch/i],
        translations: {
          kn: 'ದಯವಿಟ್ಟು ಹತ್ತಿರದ ಪೊಲೀಸ್ ಠಾಣೆಗೆ ದಾರಿ ತೋರಿಸಿ ಅಥವಾ ಪೊಲೀಸರಿಗೆ ಕರೆ ಮಾಡಿ.',
          hi: 'कृपया नजदीकी पुलिस स्टेशन का रास्ता बताएं या पुलिस को फोन करें।',
          mr: 'कृपया जवळच्या पोलीस ठाण्याचा मार्ग दाखवा किंवा पोलिसांना फोन करा.',
        },
      },
      {
        patterns: [/hotel/i, /stay/i, /room/i],
        translations: {
          kn: 'ನಾನು ನನ್ನ ಹೋಟೆಲ್ ಅನ್ನು ಹುಡುಕುತ್ತಿದ್ದೇನೆ, ದಯವಿಟ್ಟು ದಾರಿ ತೋರಿಸಿ.',
          hi: 'मैं अपने होटल को खोज रहा हूँ, कृपया रास्ता बताएं।',
          mr: 'मी माझे हॉटेल शोधत आहे, कृपया मार्ग दाखवा.',
        },
      },
      {
        patterns: [/water/i, /thirsty/i, /drink/i],
        translations: {
          kn: 'ದಯವಿಟ್ಟು ಕುಡಿಯುವ ನೀರು ಎಲ್ಲಿ ಸಿಗುತ್ತದೆ ಎಂದು ತಿಳಿಸಿ.',
          hi: 'कृपया मुझे पीने का पानी चाहिए।',
          mr: 'कृपया मला पिण्याचे पाणी हवे आहे.',
        },
      },
      {
        patterns: [/station/i, /train/i, /bus/i, /taxi/i, /auto/i],
        translations: {
          kn: 'ದಯವಿಟ್ಟು ಬಸ್ ಅಥವಾ ರೈಲ್ವೆ ನಿಲ್ದಾಣಕ್ಕೆ ಹೋಗುವ ದಾರಿ ತಿಳಿಸಿ.',
          hi: 'कृपया बस या रेलवे स्टेशन का रास्ता बताएं।',
          mr: 'कृपया बस किंवा रेल्वे स्थानकाचा मार्ग दाखवा.',
        },
      },
      {
        patterns: [/help/i, /madad/i, /emergency/i],
        translations: {
          kn: 'ದಯವಿಟ್ಟು ನನಗೆ ತಕ್ಷಣ ಸಹಾಯ ಮಾಡಿ!',
          hi: 'कृपया मेरी तुरंत मदद करें!',
          mr: 'कृपया मला तातडीने मदत करा!',
        },
      },
    ];
  }

  /**
   * Translate text into target language
   * @param {string} text - Source text (typically English)
   * @param {string} targetLang - Target language code ('kn', 'hi', 'mr', 'en')
   * @returns {Promise<string>} Translated text in native script
   */
  async translateText(text, targetLang = 'kn') {
    if (!text || !text.trim()) return '';
    const cleanText = text.trim();

    // If target is English and source looks English, return as-is
    if (targetLang === 'en') {
      return cleanText;
    }

    // 1. Try high-speed Google Translate API
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(cleanText)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json) && Array.isArray(json[0])) {
          const translated = json[0]
            .map((item) => (Array.isArray(item) ? item[0] : ''))
            .filter(Boolean)
            .join(' ')
            .trim();

          if (translated && translated.length > 0) {
            return translated;
          }
        }
      }
    } catch (e) {
      console.warn('Online translation network attempt finished, checking fallback:', e.message);
    }

    // 2. Offline fallback for key tourist terms
    return this.fallbackTranslate(cleanText, targetLang);
  }

  /**
   * Offline fallback rule matcher
   */
  fallbackTranslate(text, targetLang) {
    for (const rule of this.offlineDictionary) {
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          if (rule.translations[targetLang]) {
            return rule.translations[targetLang];
          }
        }
      }
    }

    // Universal emergency polite request fallback if no specific pattern matches
    if (targetLang === 'kn') {
      return `ದಯವಿಟ್ಟು ಗಮನಿಸಿ: "${text}" ಎಂದು ಪ್ರವಾಸಿಗರು ಹೇಳುತ್ತಿದ್ದಾರೆ. ದಯವಿಟ್ಟು ಸಹಾಯ ಮಾಡಿ.`;
    }
    if (targetLang === 'hi') {
      return `कृपया ध्यान दें: पर्यटक कह रहे हैं: "${text}". कृपया मदद करें।`;
    }
    if (targetLang === 'mr') {
      return `कृपया लक्ष द्या: पर्यटक म्हणत आहेत: "${text}". कृपया मदत करा.`;
    }

    return text;
  }
}

export const translationService = new TranslationService();
export default translationService;

