const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { buildTouristContext } = require('../services/ragService');
const { generateSafetyResponse } = require('../services/geminiService');

/**
 * Optional Auth Middleware: Extract user if token present, but don't block guests
 */
function optionalAuth(req, _res, next) {
  try {
    const rawCookie = String(req.headers.cookie || '');
    const cookieToken = rawCookie
      .split(';')
      .map((p) => p.trim())
      .find((p) => p.startsWith('safevoyage_session='))
      ?.slice('safevoyage_session='.length);
    const authHeader = String(req.headers.authorization || '');
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const token = bearerToken || (cookieToken ? decodeURIComponent(cookieToken) : '');

    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
      req.user = payload;
    }
  } catch (_) {}
  next();
}

/**
 * GET /chat/initial-status
 * Live greeting & safety posture based on GPS coords
 */
router.get('/initial-status', optionalAuth, async (req, res) => {
  try {
    const lat = Number(req.query.lat || 15.812463);
    const lng = Number(req.query.lng || 74.485458);
    const userId = req.user?.id || req.query.userId || null;

    const context = await buildTouristContext({
      latitude: lat,
      longitude: lng,
      userId,
      query: 'status safety location',
    });

    const isSafe = !context.currentZone || context.currentZone.zoneType === 'safe';
    const zoneName = context.currentZone ? context.currentZone.name : 'Safe Green Corridor';
    const hospitalName = context.nearestHospital ? context.nearestHospital.name : 'Udyambag Multispeciality Hospital';
    const hospitalDist = context.nearestHospital ? (context.nearestHospital.formattedDistance || context.nearestHospital.distanceFormatted) : 'Nearby';
    const policeName = context.nearestPolice ? context.nearestPolice.name : 'Udyambag Police Station';
    const policeDist = context.nearestPolice ? (context.nearestPolice.formattedDistance || context.nearestPolice.distanceFormatted) : 'Nearby';
    const pharmacyName = context.nearestPharmacy ? context.nearestPharmacy.name : 'Sanjeevani Medical Stores';
    const pharmacyDist = context.nearestPharmacy ? (context.nearestPharmacy.formattedDistance || context.nearestPharmacy.distanceFormatted) : 'Nearby';

    const greetingMessage =
      `👋 **Hello ${context.touristUser?.name || 'Tourist'}!** Welcome to **Raksha AI**.\n\n` +
      `🛡️ **Live Safety Telemetry:**\n` +
      `• **Zone:** ${zoneName} (${isSafe ? '✅ Safe' : '⚠️ Alert'})\n` +
      `• **Nearest Police Station:** ${policeName} (${policeDist})\n` +
      `• **Nearest 24/7 Hospital:** ${hospitalName} (${hospitalDist})\n` +
      `• **Nearest Medical Shop:** ${pharmacyName} (${pharmacyDist})\n\n` +
      `How can I assist you with your travel, safe navigation, or medical emergency assistance today?`;

    res.json({
      success: true,
      greeting: greetingMessage,
      telemetry: {
        isSafe,
        zoneName,
        zoneType: context.currentZone ? context.currentZone.zoneType : 'safe',
        nearestHospital: `${hospitalName} (${hospitalDist})`,
        nearestPolice: `${policeName} (${policeDist})`,
        nearestPharmacy: `${pharmacyName} (${pharmacyDist})`,
        coords: context.coords,
      },
      quickChips: [
        '🛡️ Is my current location safe?',
        '🏥 Nearest hospital, police & medical shop',
        '💊 Where is the nearest medical shop?',
        '🏛️ Top attractions near me',
        '🚨 I am in danger! What should I do?',
        '🗺️ Plan a safe 1-day trip',
        '🎒 Travel safety checklist',
      ],
    });
  } catch (error) {
    console.error('Initial status error:', error);
    res.status(500).json({ success: false, error: 'Could not load safety status' });
  }
});

/**
 * POST /chat/assistant
 * Ask Raksha AI with live GPS, geofences, and RAG tourism knowledge
 */
router.post('/assistant', optionalAuth, async (req, res) => {
  try {
    const { message, coords, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty' });
    }

    const lat = coords?.latitude || req.body.latitude || 15.812463;
    const lng = coords?.longitude || req.body.longitude || 74.485458;
    const userId = req.user?.id || req.body.userId || null;

    // 1. Build Grounded Real-Time Context
    const context = await buildTouristContext({
      latitude: lat,
      longitude: lng,
      userId,
      query: message,
    });

    // 2. Query Gemini with Failover & Fallback
    const result = await generateSafetyResponse({
      userQuery: message.trim(),
      context,
      history: Array.isArray(history) ? history : [],
    });

    res.json({
      success: true,
      message: result.message,
      suggestedActions: result.suggestedActions,
      suggestedQuestions: result.suggestedQuestions,
      telemetry: result.telemetry,
    });
  } catch (error) {
    console.error('Chat assistant error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process AI safety assistant request',
    });
  }
});

/**
 * POST /chat/transcribe
 * Multimodal Speech-to-Text using Gemini
 */
router.post('/transcribe', optionalAuth, async (req, res) => {
  try {
    const { audio, mimeType = 'audio/m4a' } = req.body;
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ success: false, error: 'Audio base64 data required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'AI transcription key not configured' });
    }

    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = audio.includes(',') ? audio.split(',')[1] : audio;

    const candidateModels = [
      'gemini-flash-latest',
      'gemini-omni-flash-preview',
      'gemini-omni-1.1-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
    ];

    let transcribedText = '';
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Listen to this tourist voice audio. Transcribe the exact words spoken into clear English text. Output ONLY the transcribed sentence or question. Do not add any conversational replies, notes, explanations, or quotes. If no speech is heard or it is silent, return: ""',
                  },
                  {
                    inlineData: {
                      mimeType: mimeType || 'audio/m4a',
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 256,
            },
          }),
        });

        const data = await geminiRes.json();
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          transcribedText = data.candidates[0].content.parts[0].text.trim();
          break;
        } else if (data?.error) {
          console.warn(`Transcription model ${model} error:`, data.error.message || data.error);
        }
      } catch (err) {
        console.warn(`Transcription model ${model} network error:`, err.message);
      }
    }

    // Strip quotation marks if Gemini wrapped it in quotes
    transcribedText = transcribedText.replace(/^["']|["']$/g, '').trim();

    res.json({
      success: true,
      text: transcribedText,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ success: false, error: 'Audio transcription failed' });
  }
});

/**
 * GET /chat/recorder
 * Secure HTTPS Audio Recorder Web Page for Mobile WebView
 */
router.get('/recorder', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Raksha Voice Recorder</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f172a;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 14px 10px;
      overflow: hidden;
      user-select: none;
    }
    .mic-button {
      width: 74px;
      height: 74px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0284c7, #0369a1);
      border: 3px solid #38bdf8;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
      transition: all 0.2s ease;
    }
    .mic-button.recording {
      background: linear-gradient(135deg, #ef4444, #b91c1c);
      border-color: #f87171;
      box-shadow: 0 0 25px rgba(239, 68, 68, 0.6);
      animation: pulse 1.2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.08); }
      100% { transform: scale(1); }
    }
    .mic-icon {
      width: 32px;
      height: 32px;
      fill: #ffffff;
    }
    .status-text {
      margin-top: 10px;
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
      text-align: center;
      min-height: 18px;
    }
    .status-text.recording { color: #f87171; }
    .action-btn {
      margin-top: 10px;
      padding: 9px 20px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-stop { background: #dc2626; }
    .btn-start { background: #0284c7; }
    .transcript-box {
      margin-top: 10px;
      background: rgba(30, 41, 59, 0.85);
      border: 1.5px solid #38bdf8;
      border-radius: 12px;
      padding: 10px 14px;
      width: 100%;
      max-width: 340px;
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      text-align: center;
      min-height: 44px;
    }
  </style>
</head>
<body>
  <div id="micBtn" class="mic-button" onclick="toggleRecording()">
    <svg class="mic-icon" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>
  </div>

  <div id="statusText" class="status-text">Tap microphone to speak</div>

  <button id="toggleBtn" class="action-btn btn-start" onclick="toggleRecording()">
    🎙️ Tap to Speak
  </button>

  <div id="transcriptBox" class="transcript-box">
    Spoken words will appear here...
  </div>

  <script>
    var mediaRecorder = null;
    var audioChunks = [];
    var isRecording = false;
    var recognition = null;
    var streamRef = null;
    var timerRef = null;
    var seconds = 0;
    var currentSpeechText = '';

    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = function(event) {
          var text = '';
          for (var i = 0; i < event.results.length; ++i) {
            text += event.results[i][0].transcript + ' ';
          }
          text = text.trim();
          if (text) {
            currentSpeechText = text;
            updateTranscript(text);
          }
        };

        recognition.onerror = function(event) {
          console.log('SpeechRecognition notice:', event.error);
        };
      } catch (e) {
        recognition = null;
      }
    }

    function updateTranscript(text) {
      document.getElementById('transcriptBox').textContent = '"' + text + '"';
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'INTERIM_TEXT',
          text: text
        }));
      }
    }

    function toggleRecording() {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }

    function startRecording() {
      audioChunks = [];
      seconds = 0;
      currentSpeechText = '';
      document.getElementById('statusText').textContent = 'Opening microphone...';

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('statusText').textContent = '⚠️ Microphone not available';
        return;
      }

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
          streamRef = stream;
          var options = {};
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
              options = { mimeType: 'audio/webm;codecs=opus' };
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
              options = { mimeType: 'audio/webm' };
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
              options = { mimeType: 'audio/mp4' };
            }
          }

          try {
            mediaRecorder = new MediaRecorder(stream, options);
          } catch (_) {
            mediaRecorder = new MediaRecorder(stream);
          }

          mediaRecorder.ondataavailable = function(e) {
            if (e.data && e.data.size > 0) {
              audioChunks.push(e.data);
            }
          };

          mediaRecorder.onstop = function() {
            var mime = mediaRecorder.mimeType || 'audio/webm';
            var blob = new Blob(audioChunks, { type: mime });
            var reader = new FileReader();
            reader.onloadend = function() {
              sendAudioToBackend(reader.result, mime);
            };
            reader.readAsDataURL(blob);

            if (streamRef) {
              try { streamRef.getTracks().forEach(function(t) { t.stop(); }); } catch (_) {}
              streamRef = null;
            }
          };

          mediaRecorder.start(200);
          isRecording = true;

          if (recognition) {
            try { recognition.start(); } catch (_) {}
          }

          document.getElementById('micBtn').classList.add('recording');
          document.getElementById('statusText').classList.add('recording');
          document.getElementById('statusText').textContent = '🔴 Listening... Speak now! (00:00)';
          document.getElementById('toggleBtn').className = 'action-btn btn-stop';
          document.getElementById('toggleBtn').textContent = '⏹️ Stop & Convert to Text';

          timerRef = setInterval(function() {
            seconds++;
            document.getElementById('statusText').textContent = '🔴 Listening... Speak now! (00:0' + seconds + ')';
            if (seconds >= 7) {
              stopRecording();
            }
          }, 1000);

          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'RECORDING_STARTED' }));
          }
        })
        .catch(function(err) {
          console.error('Mic access error:', err);
          document.getElementById('statusText').textContent = '⚠️ ' + (err.message || 'Microphone access denied');
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', error: err.message }));
          }
        });
    }

    function stopRecording() {
      if (!isRecording) return;
      isRecording = false;

      if (timerRef) {
        clearInterval(timerRef);
        timerRef = null;
      }

      document.getElementById('micBtn').classList.remove('recording');
      document.getElementById('statusText').classList.remove('recording');
      document.getElementById('statusText').textContent = currentSpeechText ? '✅ Spoken question recognized:' : '✨ Processing your speech...';
      document.getElementById('toggleBtn').className = 'action-btn btn-start';
      document.getElementById('toggleBtn').textContent = '🎙️ Tap to Speak Again';

      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }

      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try { mediaRecorder.stop(); } catch (_) {}
      }

      // If on-device recognizer captured text, deliver it immediately!
      if (currentSpeechText && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'TRANSCRIPTION_RESULT',
          text: currentSpeechText
        }));
      }
    }

    function sendAudioToBackend(base64Audio, mimeType) {
      fetch('/chat/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio, mimeType: mimeType })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success && data.text) {
          document.getElementById('statusText').textContent = '✅ Spoken question recognized:';
          document.getElementById('transcriptBox').textContent = '"' + data.text + '"';
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'TRANSCRIPTION_RESULT',
              text: data.text,
              base64: base64Audio
            }));
          }
        } else if (!currentSpeechText) {
          document.getElementById('statusText').textContent = '⚠️ No speech detected. Please speak closer.';
        }
      })
      .catch(function(err) {
        if (!currentSpeechText) {
          document.getElementById('statusText').textContent = '⚠️ Could not transcribe audio. Select a query below.';
        }
      });
    }

    window.addEventListener('load', function() {
      setTimeout(function() {
        startRecording();
      }, 400);
    });
  </script>
</body>
</html>`);
});

module.exports = router;

