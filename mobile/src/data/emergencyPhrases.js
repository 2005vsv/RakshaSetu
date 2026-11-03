/**
 * Multilingual Emergency Phrasebook Data
 * Supported Languages:
 * - kn: Kannada (ಕನ್ನಡ) - Local State Language of Karnataka / Belagavi
 * - hi: Hindi (हिंदी) - National Language
 * - mr: Marathi (मराठी) - Regional Border Language (Belagavi / Maharashtra border)
 * - en: English - Universal International Reference
 */

export const SUPPORTED_LANGUAGES = [
  {
    code: 'kn',
    speechCode: 'kn-IN',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    badge: '⭐ Local State',
    flag: '🟡🔴',
    localeName: 'Karnataka Local',
  },
  {
    code: 'hi',
    speechCode: 'hi-IN',
    name: 'Hindi',
    nativeName: 'हिंदी',
    badge: 'National',
    flag: '🇮🇳',
    localeName: 'Pan-India',
  },
  {
    code: 'mr',
    speechCode: 'mr-IN',
    name: 'Marathi',
    nativeName: 'मराठी',
    badge: 'Regional',
    flag: '🚩',
    localeName: 'Belagavi / MH Border',
  },
  {
    code: 'en',
    speechCode: 'en-IN',
    name: 'English',
    nativeName: 'English',
    badge: 'Universal',
    flag: '🌐',
    localeName: 'International',
  },
];

export const PHRASE_CATEGORIES = [
  { id: 'all', label: 'All Phrases', icon: 'grid-outline' },
  { id: 'sos', label: '🚨 Critical SOS', icon: 'warning-outline' },
  { id: 'police', label: '🚓 Police & Crime', icon: 'shield-outline' },
  { id: 'medical', label: '🏥 Medical & Doctor', icon: 'medkit-outline' },
  { id: 'lost', label: '🧭 Lost & Directions', icon: 'compass-outline' },
];

export const EMERGENCY_PHRASES = [
  // 🚨 CRITICAL SOS
  {
    id: 'p-lost-police',
    category: 'sos',
    icon: 'compass',
    english: 'I am lost, please direct me to the nearest police station.',
    translations: {
      kn: {
        text: 'ನಾನು ದಾರಿ ತಪ್ಪಿದ್ದೇನೆ, ದಯವಿಟ್ಟು ಹತ್ತಿರದ ಪೊಲೀಸ್ ಠಾಣೆಗೆ ದಾರಿ ತೋರಿಸಿ.',
        phonetic: 'Naanu daari tappiddēne, dayavittu hattirada police thaanege daari torisi.',
      },
      hi: {
        text: 'मैं रास्ता भटक गया हूँ, कृपया मुझे नजदीकी पुलिस स्टेशन का रास्ता बताएं।',
        phonetic: 'Main rasta bhatak gaya hoon, kripya mujhe nazdeeki police station ka rasta batayein.',
      },
      mr: {
        text: 'मी रस्ता चुकलो आहे, कृपया जवळच्या पोलीस ठाण्याचा मार्ग दाखवा.',
        phonetic: 'Mee rasta chuklo aahe, krupaya javalchya police thanyacha marga dakhva.',
      },
      en: {
        text: 'I am lost, please direct me to the nearest police station.',
        phonetic: 'I am lost, please direct me to the nearest police station.',
      },
    },
  },
  {
    id: 'p-medical-ambulance',
    category: 'sos',
    icon: 'medkit',
    english: 'I have a medical emergency, please call an ambulance immediately.',
    translations: {
      kn: {
        text: 'ನನಗೆ ವೈದ್ಯಕೀಯ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಿದೆ, ದಯವಿಟ್ಟು ತಕ್ಷಣ ಆಂಬ್ಯುಲೆನ್ಸ್ ಕರೆಯಿರಿ.',
        phonetic: 'Nanage vaidyakīya turtu paristhitiyide, dayavittu takshana ambulance kareyiri.',
      },
      hi: {
        text: 'मुझे मेडिकल इमरजेंसी है, कृपया तुरंत एम्बुलेंस बुलाएं।',
        phonetic: 'Mujhe medical emergency hai, kripya turant ambulance bulayein.',
      },
      mr: {
        text: 'मला वैद्यकीय आणीबाणी आहे, कृपया तातडीने रुग्णवाहिका बोलवा.',
        phonetic: 'Mala vaidyakiya aanibani aahe, krupaya taatadine rugnavahika bolva.',
      },
      en: {
        text: 'I have a medical emergency, please call an ambulance immediately.',
        phonetic: 'I have a medical emergency, please call an ambulance immediately.',
      },
    },
  },
  {
    id: 'p-theft-bag',
    category: 'police',
    icon: 'briefcase',
    english: 'Someone snatched my bag and passport! Please help me!',
    translations: {
      kn: {
        text: 'ಯಾರೋ ನನ್ನ ಬ್ಯಾಗ್ ಮತ್ತು ಪಾಸ್‌ಪೋರ್ಟ್ ಕಸಿದುಕೊಂಡಿದ್ದಾರೆ! ದಯವಿಟ್ಟು ನನಗೆ ಸಹಾಯ ಮಾಡಿ!',
        phonetic: 'Yaaro nanna bag mattu passport kasidukondiddaare! Dayavittu nanage sahaaya maadi!',
      },
      hi: {
        text: 'किसी ने मेरा बैग और पासपोर्ट छीन लिया है! कृपया मेरी मदद करें!',
        phonetic: 'Kisi ne mera bag aur passport chheen liya hai! Kripya meri madad karein!',
      },
      mr: {
        text: 'कोणीतरी माझी बॅग आणि पासपोर्ट हिसकावून घेतला आहे! कृपया मला मदत करा!',
        phonetic: 'Konitari mazhi bag aani passport hiskavun ghetla aahe! Krupaya mala madat kara!',
      },
      en: {
        text: 'Someone snatched my bag and passport! Please help me!',
        phonetic: 'Someone snatched my bag and passport! Please help me!',
      },
    },
  },
  {
    id: 'p-following-unsafe',
    category: 'police',
    icon: 'eye',
    english: 'I feel unsafe, someone is following me. Please stay with me or call police.',
    translations: {
      kn: {
        text: 'ನನಗೆ ಸುರಕ್ಷಿತವಲ್ಲ ಎಂದು ಅನಿಸುತ್ತಿದೆ, ಯಾರೋ ನನ್ನನ್ನು ಹಿಂಬಾಲಿಸುತ್ತಿದ್ದಾರೆ. ದಯವಿಟ್ಟು ಪೊಲೀಸರನ್ನು ಕರೆಯಿರಿ.',
        phonetic: 'Nanage surakshitavalla endu anisuttide, yaaro nannannu himbaalisuttiddaare. Dayavittu policerannu kareyiri.',
      },
      hi: {
        text: 'मुझे खतरा महसूस हो रहा है, कोई मेरा पीछा कर रहा है। कृपया पुलिस को बुलाएं।',
        phonetic: 'Mujhe khatra mehsoos ho raha hai, koi mera peecha kar raha hai. Kripya police ko bulayein.',
      },
      mr: {
        text: 'मला धोका वाटत आहे, कोणीतरी माझा पाठलाग करत आहे. कृपया पोलिसांना बोलवा.',
        phonetic: 'Mala dhoka vaatat aahe, konitari mazha paathlag karat aahe. Krupaya polisanna bolva.',
      },
      en: {
        text: 'I feel unsafe, someone is following me. Please stay with me or call police.',
        phonetic: 'I feel unsafe, someone is following me. Please stay with me or call police.',
      },
    },
  },
  // 🏥 MEDICAL & HEALTH
  {
    id: 'p-nearest-hospital',
    category: 'medical',
    icon: 'business',
    english: 'Where is the nearest hospital or emergency clinic?',
    translations: {
      kn: {
        text: 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆ ಅಥವಾ ತುರ್ತು ಕ್ಲಿನಿಕ್ ಎಲ್ಲಿದೆ?',
        phonetic: 'Hattirada aaspatre athavaa turtu clinic ellide?',
      },
      hi: {
        text: 'नजदीकी अस्पताल या इमरजेंसी क्लिनिक कहाँ है?',
        phonetic: 'Nazdeeki aspatal ya emergency clinic kahan hai?',
      },
      mr: {
        text: 'जवळचे रुग्णालय किंवा आपत्कालीन दवाखाना कुठे आहे?',
        phonetic: 'Javalche rugnalaya kinva aapatkaaleen davakhana kuthe aahe?',
      },
      en: {
        text: 'Where is the nearest hospital or emergency clinic?',
        phonetic: 'Where is the nearest hospital or emergency clinic?',
      },
    },
  },
  {
    id: 'p-cannot-walk',
    category: 'medical',
    icon: 'bandage',
    english: 'I am severely injured and cannot walk. Please dial 108 or 112.',
    translations: {
      kn: {
        text: 'ನನಗೆ ತೀವ್ರ ಗಾಯವಾಗಿದೆ ಮತ್ತು ನಡೆಯಲು ಸಾಧ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು 108 ಅಥವಾ 112 ಗೆ ಕರೆ ಮಾಡಿ.',
        phonetic: 'Nanage teevra gaayavaagide mattu nadeyalu saadhyavilla. Dayavittu 108 athavaa 112 ge kare maadi.',
      },
      hi: {
        text: 'मैं गंभीर रूप से घायल हूँ और चल नहीं सकता। कृपया 108 या 112 पर कॉल करें।',
        phonetic: 'Main gambhir roop se ghayal hoon aur chal nahin sakta. Kripya 108 ya 112 par call karein.',
      },
      mr: {
        text: 'मी गंभीर जखमी झालो आहे आणि चालू शकत नाही. कृपया 108 किंवा 112 ला कॉल करा.',
        phonetic: 'Mee gambhir jakhami jhalo aahe aani chaalu shakat naahi. Krupaya 108 kinva 112 la call kara.',
      },
      en: {
        text: 'I am severely injured and cannot walk. Please dial 108 or 112.',
        phonetic: 'I am severely injured and cannot walk. Please dial 108 or 112.',
      },
    },
  },
  {
    id: 'p-urgent-pharmacy',
    category: 'medical',
    icon: 'fitness',
    english: 'I need urgent medicine. Is there a 24-hour pharmacy nearby?',
    translations: {
      kn: {
        text: 'ನನಗೆ ತುರ್ತಾಗಿ ಔಷಧಿ ಬೇಕು. ಹತ್ತಿರದಲ್ಲಿ 24 ಗಂಟೆಗಳ ಮೆಡಿಕಲ್ ಶಾಪ್ ಇದೆಯೇ?',
        phonetic: 'Nanage turtaagi aushadhi beku. Hattiradalli 24 gantegala medical shop ideye?',
      },
      hi: {
        text: 'मुझे तुरंत दवा चाहिए। क्या आसपास 24 घंटे का मेडिकल स्टोर है?',
        phonetic: 'Mujhe turant dava chahiye. Kya aaspaas 24 ghante ka medical store hai?',
      },
      mr: {
        text: 'मला तातडीने औषध हवे आहे. जवळ 24 तास सुरू असलेले मेडिकल स्टोअर आहे का?',
        phonetic: 'Mala taatadine aushadh have aahe. Javal 24 taas suru aslele medical store aahe ka?',
      },
      en: {
        text: 'I need urgent medicine. Is there a 24-hour pharmacy nearby?',
        phonetic: 'I need urgent medicine. Is there a 24-hour pharmacy nearby?',
      },
    },
  },
  // 🧭 LOST & DIRECTIONS
  {
    id: 'p-drive-hospital',
    category: 'lost',
    icon: 'car',
    english: 'Please take me to the nearest government hospital immediately.',
    translations: {
      kn: {
        text: 'ದಯವಿಟ್ಟು ನನ್ನನ್ನು ತಕ್ಷಣ ಹತ್ತಿರದ ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆಗೆ ಕರೆದುಕೊಂಡು ಹೋಗಿ.',
        phonetic: 'Dayavittu nannannu takshana hattirada sarkari aaspatrege karedukondu hogi.',
      },
      hi: {
        text: 'कृपया मुझे तुरंत नजदीकी सरकारी अस्पताल ले चलिए।',
        phonetic: 'Kripya mujhe turant nazdeeki sarkari aspatal le chaliye.',
      },
      mr: {
        text: 'कृपया मला तातडीने जवळच्या सरकारी रुग्णालयात घेऊन चला.',
        phonetic: 'Krupaya mala taatadine javalchya sarkari rugnalayat gheun chala.',
      },
      en: {
        text: 'Please take me to the nearest government hospital immediately.',
        phonetic: 'Please take me to the nearest government hospital immediately.',
      },
    },
  },
  {
    id: 'p-tourist-police',
    category: 'lost',
    icon: 'globe',
    english: 'I am a foreign tourist. I need to contact my embassy and Tourist Police.',
    translations: {
      kn: {
        text: 'ನಾನು ವಿದೇಶಿ ಪ್ರವಾಸಿ. ನನಗೆ ರಾಯಭಾರ ಕಚೇರಿ ಮತ್ತು ಪ್ರವಾಸಿ ಪೊಲೀಸರನ್ನು ಸಂಪರ್ಕಿಸಬೇಕಾಗಿದೆ.',
        phonetic: 'Naanu videshi pravaasi. Nanage raayabhaara kachēri mattu pravaasi policerannu samparkisabēkaagide.',
      },
      hi: {
        text: 'मैं एक विदेशी पर्यटक हूँ। मुझे अपने दूतावास और टूरिस्ट पुलिस से संपर्क करना है।',
        phonetic: 'Main ek videshi paryatak hoon. Mujhe apne dootavas aur tourist police se sampark karna hai.',
      },
      mr: {
        text: 'मी एक परदेशी पर्यटक आहे. मला माझ्या दूतावासाशी आणि पर्यटक पोलिसांशी संपर्क करायचा आहे.',
        phonetic: 'Mee ek pardeshi paryatak aahe. Mala mazhya dootavaasashi aani paryatak polisanshi sampark karaycha aahe.',
      },
      en: {
        text: 'I am a foreign tourist. I need to contact my embassy and Tourist Police.',
        phonetic: 'I am a foreign tourist. I need to contact my embassy and Tourist Police.',
      },
    },
  },
  {
    id: 'p-no-speak-local',
    category: 'lost',
    icon: 'chatbubbles',
    english: 'I do not speak the local language. Please speak slowly or help me find an English translator.',
    translations: {
      kn: {
        text: 'ನನಗೆ ಸ್ಥಳೀಯ ಭಾಷೆ ಮಾತನಾಡಲು ಬರುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಧಾನವಾಗಿ ಮಾತನಾಡಿ ಅಥವಾ ಸಹಾಯ ಮಾಡಿ.',
        phonetic: 'Nanage sthaliya bhaashe maatanaadalu baruvudilla. Dayavittu nidhaanavaagi maatanaadi athavaa sahaaya maadi.',
      },
      hi: {
        text: 'मुझे स्थानीय भाषा नहीं आती। कृपया धीरे बोलें या अंग्रेजी अनुवाद में मदद करें।',
        phonetic: 'Mujhe sthaniya bhasha nahin aati. Kripya dheere bolein ya angrezi anuvaad mein madad karein.',
      },
      mr: {
        text: 'मला स्थानिक भाषा येत नाही. कृपया हळू बोला किंवा मला इंग्रजीत मदत करा.',
        phonetic: 'Mala sthaneek bhasha yet naahi. Krupaya haloo bola kinva mala ingrajit madat kara.',
      },
      en: {
        text: 'I do not speak the local language. Please speak slowly or help me find an English translator.',
        phonetic: 'I do not speak the local language. Please speak slowly or help me find an English translator.',
      },
    },
  },
];

