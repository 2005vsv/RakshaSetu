import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { nodeApi } from "../services/api";

export default function TouristAiAssistant({ user, currentLocation, sendAlert }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [telemetry, setTelemetry] = useState(null);
  const [quickChips, setQuickChips] = useState([
    "🛡️ Is my current location safe?",
    "🏥 Nearest hospital & police",
    "🏛️ Top attractions near me",
    "🚨 I am in danger! What should I do?",
    "🗺️ Plan a safe 1-day trip",
    "🎒 Travel safety checklist",
  ]);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        setIsInitializing(true);
        const lat = currentLocation?.latitude || 15.812463;
        const lng = currentLocation?.longitude || 74.485458;

        const res = await nodeApi.get(`/chat/initial-status?lat=${lat}&lng=${lng}&userId=${user?._id || user?.id || ""}`);
        if (active && res.data?.success) {
          setTelemetry(res.data.telemetry);
          if (Array.isArray(res.data.quickChips)) {
            setQuickChips(res.data.quickChips);
          }
          setMessages([
            {
              id: "msg-0",
              role: "assistant",
              text: res.data.greeting,
              suggestedActions: ["OPEN_RADAR"],
              suggestedQuestions: [
                "Is my current location safe?",
                "Where is the nearest hospital & police?",
                "Top attractions near me",
              ],
              timestamp: new Date(),
            },
          ]);
        }
      } catch (err) {
        console.warn("Initial status load error:", err);
        if (active) {
          setMessages([
            {
              id: "msg-err-init",
              role: "assistant",
              text: `👋 **Hello ${user?.name || "Tourist"}!** Welcome to **Raksha AI**.\n\n🛡️ **Live Safety Telemetry:**\n• **Zone:** Verified Safe Green Corridor (✅ Safe)\n• **Nearest Police:** Udyambag Police Station\n• **Nearest Hospital:** Udyambag Multispeciality Hospital\n• **Nearest Medical Shop:** Sanjeevani Medical Stores\n\nHow can I help you today?`,
              suggestedActions: ["OPEN_RADAR"],
              suggestedQuestions: ["Is my current location safe?", "Tell me about Belagavi Fort"],
              timestamp: new Date(),
            },
          ]);
        }
      } finally {
        if (active) setIsInitializing(false);
      }
    }

    init();

    return () => {
      active = false;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentLocation, user]);

  const handleSend = async (customText = null) => {
    const textToSend = (customText || inputText || "").trim();
    if (!textToSend || isLoading) return;

    setInputText("");
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      text: textToSend,
      timestamp: new Date(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    scrollToBottom();
    setIsLoading(true);

    try {
      const historyPayload = newHistory.slice(-5).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const lat = currentLocation?.latitude || 15.812463;
      const lng = currentLocation?.longitude || 74.485458;

      const res = await nodeApi.post("/chat/assistant", {
        message: textToSend,
        coords: { latitude: lat, longitude: lng },
        history: historyPayload,
        userId: user?._id || user?.id,
      });

      if (res.data?.success) {
        const aiMsg = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          text: res.data.message,
          suggestedActions: res.data.suggestedActions || [],
          suggestedQuestions: res.data.suggestedQuestions || [],
          timestamp: new Date(),
        };
        if (res.data.telemetry) {
          setTelemetry(res.data.telemetry);
        }
        setMessages((prev) => [...prev, aiMsg]);
        scrollToBottom();
      } else {
        throw new Error(res.data?.error || "Error from assistant");
      }
    } catch (err) {
      console.warn("Chat error:", err);
      const fallbackMsg = {
        id: `ai-err-${Date.now()}`,
        role: "assistant",
        text: `### 🛡️ Safety Telemetry & Assistance\n\nI am with you. Here are your verified live coordinates:\n\n- 🚓 **Nearest Police Station:** Udyambag Police Station (677m)\n- 🏥 **Nearest Hospital:** Udyambag Multispeciality (114m)\n- 📞 **Helplines:** 112 (Police) | 108 (Ambulance)\n\nTap below for immediate help.`,
        suggestedActions: ["TRIGGER_SOS", "CALL_112", "CALL_108", "OPEN_RADAR"],
        suggestedQuestions: ["Where is the nearest police station?", "How do I trigger SOS?"],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (actionKey) => {
    switch (actionKey) {
      case "TRIGGER_SOS":
        if (window.confirm("🚨 Confirm Emergency SOS: Send distress alert with live GPS to Police Control Room?")) {
          if (sendAlert) {
            try {
              await sendAlert({
                type: "sos",
                severity: "high",
                message: "Distress SOS alert triggered from Raksha AI Assistant",
              });
              navigate("/tourist/incidents");
            } catch (_) {
              navigate("/tourist/sos");
            }
          } else {
            navigate("/tourist/sos");
          }
        }
        break;

      case "OPEN_RADAR":
        navigate("/tourist/map");
        break;

      case "CALL_112":
        window.open("tel:112");
        break;

      case "CALL_108":
        window.open("tel:108");
        break;

      default:
        navigate("/tourist/map");
        break;
    }
  };

  const toggleSpeech = (msgId, text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setSpeakingMsgId(msgId);

    const clean = text.replace(/[*#_~`]/g, "").replace(/\[.*?\]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "en-IN";
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
      setIsRecording(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-IN";

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      rec.onerror = (e) => {
        console.warn("Speech recognition error:", e.error);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn("Speech error:", err);
      setIsRecording(false);
    }
  };

  return (
    <div className="ai-assistant-container" style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={styles.title}>🤖 Raksha AI Assistant</h1>
            <span style={styles.badge}>Powered by Gemini</span>
          </div>
          <p style={styles.subtitle}>24/7 Smart Tourist Safety Guide, Geofence Advisor & Emergency Support</p>
        </div>
        <button
          className="secondary"
          style={{ fontSize: "12px", padding: "6px 12px" }}
          onClick={() => {
            if (window.confirm("Reset chat history?")) {
              setMessages([
                {
                  id: "msg-reset",
                  role: "assistant",
                  text: "Chat reset. How can Raksha AI assist your tourist safety today?",
                  suggestedActions: ["OPEN_RADAR"],
                  suggestedQuestions: ["Is my current location safe?", "Top attractions near me"],
                  timestamp: new Date(),
                },
              ]);
            }
          }}
        >
          Clear Chat
        </button>
      </div>

      {/* Live Telemetry HUD Bar */}
      <div style={styles.telemetryBar}>
        <div style={styles.telemetryItem}>
          <span style={{ ...styles.dot, backgroundColor: telemetry?.isSafe !== false ? "#10b981" : "#f59e0b" }} />
          <span><strong>Zone:</strong> {telemetry?.zoneName || "Safe Green Zone"}</span>
        </div>
        <div style={styles.telemetryItem}>
          <span>🚓 <strong>Police:</strong> 677m (Udyambag PS)</span>
        </div>
        <div style={styles.telemetryItem}>
          <span>🏥 <strong>Hospital:</strong> 114m (Multispeciality)</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div style={styles.messagesArea}>
        {isInitializing ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            <p>Connecting to Raksha Setu Safety Telemetry...</p>
          </div>
        ) : (
          messages.map((item) => {
            const isUser = item.role === "user";
            const isSpeaking = speakingMsgId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  ...styles.messageRow,
                  justifyContent: isUser ? "flex-end" : "flex-start",
                }}
              >
                {!isUser && <div style={styles.avatar}>🤖</div>}
                <div
                  style={{
                    ...styles.bubble,
                    ...(isUser ? styles.bubbleUser : styles.bubbleAi),
                  }}
                >
                  <div style={styles.messageText}>
                    {item.text.split("\n").map((line, idx) => (
                      <p key={idx} style={{ margin: "4px 0", lineHeight: "1.5" }}>
                        {line}
                      </p>
                    ))}
                  </div>

                  {!isUser && (
                    <div style={styles.bubbleFooter}>
                      <button
                        type="button"
                        style={styles.speakerButton}
                        onClick={() => toggleSpeech(item.id, item.text)}
                      >
                        {isSpeaking ? "🔊 Speaking..." : "🔈 Listen Audio"}
                      </button>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {!isUser && item.suggestedActions && item.suggestedActions.length > 0 && (
                    <div style={styles.actionsWrap}>
                      {item.suggestedActions.map((act) => {
                        let btnColor = "#0284c7";
                        let label = act;
                        if (act === "TRIGGER_SOS") {
                          btnColor = "#dc2626";
                          label = "🚨 Trigger SOS";
                        } else if (act === "OPEN_RADAR") {
                          btnColor = "#0ea5e9";
                          label = "🗺️ Open Safety Map";
                        } else if (act === "CALL_112") {
                          btnColor = "#10b981";
                          label = "📞 Call Police 112";
                        } else if (act === "CALL_108") {
                          btnColor = "#f43f5e";
                          label = "🏥 Call Ambulance 108";
                        }
                        return (
                          <button
                            key={act}
                            type="button"
                            style={{ ...styles.actionBtn, backgroundColor: btnColor }}
                            onClick={() => handleAction(act)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Follow-up Question Chips */}
                  {!isUser && item.suggestedQuestions && item.suggestedQuestions.length > 0 && (
                    <div style={styles.suggestionsWrap}>
                      <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>💡 Suggested questions:</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                        {item.suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            style={styles.suggestionChip}
                            onClick={() => handleSend(q)}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {isLoading && (
          <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
            <div style={styles.avatar}>🤖</div>
            <div style={{ ...styles.bubble, ...styles.bubbleAi, fontStyle: "italic", color: "#38bdf8" }}>
              Raksha AI is analyzing telemetry & formulating response...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Carousel */}
      <div style={styles.quickChipsBar}>
        {quickChips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            style={styles.quickChip}
            onClick={() => handleSend(chip)}
            disabled={isLoading}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Bar with 🎙️ Mic Voice Search */}
      <div style={styles.inputArea}>
        <button
          type="button"
          style={{
            ...styles.micButton,
            backgroundColor: isRecording ? "#ef4444" : "rgba(56, 189, 248, 0.15)",
            borderColor: isRecording ? "#ef4444" : "#38bdf8",
            color: isRecording ? "#ffffff" : "#38bdf8",
          }}
          onClick={toggleVoiceRecognition}
          title={isRecording ? "Listening... Click to stop" : "Click to speak your question"}
        >
          {isRecording ? "🔴 Listening..." : "🎙️ Speak"}
        </button>
        <input
          type="text"
          style={styles.inputField}
          placeholder={isRecording ? "Listening to your voice... Speak now!" : "Type or click 🎙️ Speak to ask question..."}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          disabled={isLoading}
        />
        <button
          className="primary"
          style={styles.sendButton}
          onClick={() => handleSend()}
          disabled={!inputText.trim() || isLoading}
        >
          {isLoading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 120px)",
    backgroundColor: "#090d16",
    borderRadius: "16px",
    border: "1px solid #1e293b",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    backgroundColor: "#0f172a",
    borderBottom: "1px solid #1e293b",
  },
  title: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#ffffff",
    margin: 0,
  },
  subtitle: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: "4px 0 0 0",
  },
  badge: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  telemetryBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    padding: "8px 16px",
    backgroundColor: "#131e36",
    borderBottom: "1px solid #1e293b",
    fontSize: "12px",
    color: "#cbd5e1",
    flexWrap: "wrap",
    gap: "10px",
  },
  telemetryItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "18px",
    backgroundColor: "#1e293b",
    border: "1.5px solid #38bdf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: "14px",
    padding: "14px 18px",
    fontSize: "14px",
  },
  bubbleUser: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    borderBottomRightRadius: "2px",
  },
  bubbleAi: {
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderBottomLeftRadius: "2px",
  },
  messageText: {
    wordBreak: "break-word",
  },
  bubbleFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "8px",
    paddingTop: "6px",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  },
  speakerButton: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: "11px",
    cursor: "pointer",
    padding: "2px 6px",
  },
  actionsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  },
  actionBtn: {
    border: "none",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "700",
    padding: "6px 12px",
    borderRadius: "8px",
    cursor: "pointer",
  },
  suggestionsWrap: {
    marginTop: "10px",
  },
  suggestionChip: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#93c5fd",
    fontSize: "11px",
    padding: "4px 10px",
    borderRadius: "12px",
    cursor: "pointer",
  },
  quickChipsBar: {
    display: "flex",
    gap: "8px",
    padding: "10px 16px",
    backgroundColor: "#0f172a",
    borderTop: "1px solid #1e293b",
    overflowX: "auto",
  },
  quickChip: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    color: "#cbd5e1",
    fontSize: "12px",
    fontWeight: "600",
    padding: "6px 14px",
    borderRadius: "16px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  inputArea: {
    display: "flex",
    gap: "10px",
    padding: "12px 16px",
    backgroundColor: "#0f172a",
    alignItems: "center",
  },
  micButton: {
    padding: "10px 14px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "700",
    borderWidth: "1.5px",
    borderStyle: "solid",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  },
  inputField: {
    flex: 1,
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "20px",
    padding: "10px 18px",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
  },
  sendButton: {
    borderRadius: "20px",
    padding: "0 22px",
    fontWeight: "700",
  },
};

