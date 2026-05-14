"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, Stethoscope, TestTube, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createAISession, AIMessage, AISessionResponse } from "@/lib/healthcare";

const GREETINGS = [
  "Hello! I'm your AI Health Assistant. I can help you understand your symptoms and guide you to the right department.",
  "Welcome! Tell me about your symptoms, and I'll provide guidance on next steps.",
  "Hi there! Describe your symptoms, and I'll help you find the right care.",
];

const SUGGESTED_symptoms = [
  "Chest pain and shortness of breath",
  "Headache and fever",
  "Abdominal pain",
  "Joint pain",
  "Skin rash",
  "Fatigue and weakness",
];

const INITIAL_RESPONSE = `Based on your symptoms, I can provide some general guidance:

**Immediate Actions:**
1. Rest and stay hydrated
2. Note any other symptoms that appear
3. If symptoms worsen, seek immediate medical attention

**Recommended Next Steps:**
- Consider visiting a General Physician for initial evaluation
- Basic blood tests may help identify the cause

**Important:** This is general guidance only. Please consult a doctor for proper diagnosis and treatment.`;

export default function AIDoctorTab() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionResult, setSessionResult] = useState<AISessionResponse | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add initial greeting
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    setMessages([{ role: "assistant", content: greeting }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setError("");
    const userMessage: AIMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const currentInput = input;
    setInput("");
    setLoading(true);
    setShowSuggestions(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || "";

      const result = await createAISession(email, newMessages, currentInput);
      setSessionResult(result);

      const departmentMessage = result.recommended_tests.length > 0
        ? `Based on your symptoms, I recommend visiting the **${result.department_hint}** department.\n\n**Suggested Tests:**\n${result.recommended_tests.map(t => `- ${t}`).join("\n")}\n\n*Please consult with a doctor for proper diagnosis.*`
        : `Based on your symptoms, I recommend visiting the **${result.department_hint}** department.\n\n*Please consult with a doctor for proper diagnosis.*`;

      const aiResponse: AIMessage = {
        role: "assistant",
        content: departmentMessage,
      };
      setMessages([...newMessages, aiResponse]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
      // Add a fallback response
      const fallback: AIMessage = {
        role: "assistant",
        content: "I'm having trouble processing your request. Please try again or consult a doctor directly.",
      };
      setMessages([...newMessages, fallback]);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([{ role: "assistant", content: GREETINGS[Math.floor(Math.random() * GREETINGS.length)] }]);
    setSessionResult(null);
    setShowSuggestions(true);
    setInput("");
    setError("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Chat Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Symptom Checker</h2>
              <p className="text-sm text-gray-500">Get guidance based on your symptoms</p>
            </div>
          </div>
          <button onClick={startNewChat} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition">
            <RefreshCw className="w-4 h-4" /> New Chat
          </button>
        </div>
      </motion.div>

      {/* Chat Messages */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-y-auto">
        {error && <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl mb-4"><AlertCircle className="w-4 h-4" />{error}</div>}

        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-emerald-700">U</span>
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {showSuggestions && messages.length === 1 && (
          <div className="mt-6 p-4 bg-violet-50 rounded-xl border border-violet-100">
            <p className="text-sm font-medium text-violet-800 mb-3">Quick symptoms to try:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_symptoms.map((s) => (
                <button key={s} onClick={() => handleSuggestionClick(s)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-violet-200 text-violet-700 text-sm hover:bg-violet-100 transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result Card */}
        {sessionResult && !loading && (
          <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-800 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Assessment Complete</span>
            </div>
            <div className="text-sm text-emerald-700">
              <p><Stethoscope className="w-4 h-4 inline mr-1" />Recommended: {sessionResult.department_hint}</p>
              {sessionResult.recommended_tests.length > 0 && (
                <p className="mt-1"><TestTube className="w-4 h-4 inline mr-1" />Tests: {sessionResult.recommended_tests.join(", ")}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-3">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe your symptoms..."
            className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-violet-500 focus:outline-none transition" disabled={loading} />
          <motion.button type="submit" disabled={loading || !input.trim()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2 disabled:opacity-50">
            <Send className="w-5 h-5" /> Send
          </motion.button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">AI guidance only. Always consult a doctor for medical advice.</p>
      </motion.form>
    </div>
  );
}
