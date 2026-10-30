/**
 * SolarAssistant.tsx
 * Floating AI-powered SolarWatch Assistant for the Solar Plant Health Dashboard.
 * Matches existing luminous dark-teal frosted glass aesthetic with emerald green accents.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Sparkles,
  X,
  Send,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingDown,
  Sun,
  ShieldCheck,
  Zap,
  HelpCircle,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  ExternalLink,
} from 'lucide-react';
import { DashboardMetrics, InverterHealth, AnomalyAlert } from '../types/solar';
import {
  ChatbotContext,
  ChatMessage,
  SUGGESTED_QUESTIONS,
  generateSolarAssistantResponse,
  extractLiveTelemetrySummary,
} from '../utils/solarChatbotEngine';

interface SolarAssistantProps {
  metrics: DashboardMetrics;
  inverterSummaries: InverterHealth[];
  anomalyAlerts: AnomalyAlert[];
  selectedInverter: string;
  isUsingCustomData: boolean;
  dateRange: [string, string];
  totalRecords: number;
  onSelectInverter?: (inverterId: string) => void;
  onSelectAlertTimestamp?: (timestamp: number) => void;
}

export const SolarAssistant: React.FC<SolarAssistantProps> = ({
  metrics,
  inverterSummaries,
  anomalyAlerts,
  selectedInverter,
  isUsingCustomData,
  dateRange,
  totalRecords,
  onSelectInverter,
  onSelectAlertTimestamp,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showQuickQuestions, setShowQuickQuestions] = useState<boolean>(true);

  // Keep a reference to the active context
  const context: ChatbotContext = useMemo(
    () => ({
      metrics,
      inverterSummaries,
      anomalyAlerts,
      selectedInverter,
      isUsingCustomData,
      dateRange,
      totalRecords,
    }),
    [metrics, inverterSummaries, anomalyAlerts, selectedInverter, isUsingCustomData, dateRange, totalRecords]
  );

  // Generate welcome message
  const initialMessage: ChatMessage = useMemo(() => {
    const hasData = totalRecords > 0;
    const health = metrics.plantHealthScore;
    const lossKwh = metrics.totalEnergyLossKwh;
    const invCount = inverterSummaries.length;
    const alertCount = anomalyAlerts.length;

    let text = `👋 Hello! I am your **SolarWatch Assistant**, an intelligent monitoring copilot for your solar plant.\n\n`;

    if (hasData) {
      text += `I am actively synchronized with your **${isUsingCustomData ? 'Uploaded CSV' : 'Plant 1 Baseline'}** dataset (${dateRange[0]} to ${dateRange[1]}):\n\n`;
      text += `- **Plant Health Score:** **${health}%**\n`;
      text += `- **Energy Loss:** **${lossKwh.toLocaleString()} kWh**\n`;
      text += `- **Detected Anomalies:** **${alertCount}** events across **${invCount}** inverters\n`;
      if (selectedInverter !== 'all') {
        text += `- **Active Filter:** Focused on **${selectedInverter}**\n`;
      }
      text += `\nAsk me anything about solar performance, inverter anomalies, energy losses, or select a question below!`;
    } else {
      text += `There is currently no telemetry data loaded. Upload a CSV file or load the sample dataset to inspect plant health and energy loss insights.`;
    }

    return {
      id: 'welcome-msg',
      sender: 'assistant',
      text,
      timestamp: Date.now(),
      highlightStats: hasData
        ? [
            { label: 'Health Score', value: `${health}%`, color: health >= 90 ? 'emerald' : 'amber' },
            { label: 'Energy Loss', value: `${lossKwh.toLocaleString()} kWh`, color: 'rose' },
            { label: 'Anomalies', value: `${alertCount}`, color: 'amber' },
          ]
        : undefined,
    };
  }, [totalRecords, isUsingCustomData, dateRange, metrics, inverterSummaries.length, anomalyAlerts.length, selectedInverter]);

  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCustomDataRef = useRef<boolean>(isUsingCustomData);
  const prevRecordCountRef = useRef<number>(totalRecords);

  // Detect when user uploads a new CSV or data changes, inform the user
  useEffect(() => {
    if (
      (prevCustomDataRef.current !== isUsingCustomData || prevRecordCountRef.current !== totalRecords) &&
      totalRecords > 0
    ) {
      prevCustomDataRef.current = isUsingCustomData;
      prevRecordCountRef.current = totalRecords;

      const updateNotice: ChatMessage = {
        id: `update-${Date.now()}`,
        sender: 'assistant',
        text: `🔄 **Dataset Updated!**\n\nI have recalibrated my telemetry context to your newly loaded dataset:\n- **Source:** ${isUsingCustomData ? 'Uploaded Custom CSV' : 'Plant 1 Baseline'}\n- **Readings Analyzed:** **${totalRecords.toLocaleString()}**\n- **Current Health Score:** **${metrics.plantHealthScore}%**\n- **Updated Anomaly Count:** **${metrics.totalFaultsCount}** events\n\nAll subsequent questions will reflect this new data.`,
        timestamp: Date.now(),
        highlightStats: [
          { label: 'Health Score', value: `${metrics.plantHealthScore}%`, color: metrics.plantHealthScore >= 90 ? 'emerald' : 'amber' },
          { label: 'Total Loss', value: `${metrics.totalEnergyLossKwh.toLocaleString()} kWh`, color: 'rose' },
        ],
      };
      setMessages((prev) => [...prev, updateNotice]);
    }
  }, [isUsingCustomData, totalRecords, metrics]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate smart thinking with instant domain reasoning
    setTimeout(() => {
      const response = generateSolarAssistantResponse(query, context);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        timestamp: Date.now(),
        highlightStats: response.stats,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 450);
  };

  const handleResetChat = () => {
    setMessages([initialMessage]);
    setShowQuickQuestions(true);
  };

  // Helper to render rich markdown-like text with headers, bullet points, and code spans
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');

    return (
      <div className="space-y-2 text-sm leading-relaxed text-slate-200">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          // Empty line
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          // Header 3: ### Title
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-base font-extrabold text-teal-300 mt-2 mb-1 flex items-center gap-1.5">
                {formatInline(trimmed.replace('### ', ''))}
              </h3>
            );
          }

          // Header 4: #### Subtitle
          if (trimmed.startsWith('#### ')) {
            return (
              <h4 key={idx} className="text-sm font-bold text-emerald-400 mt-2 mb-0.5">
                {formatInline(trimmed.replace('#### ', ''))}
              </h4>
            );
          }

          // Math block: $$formula$$
          if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
            const math = trimmed.slice(2, -2).trim();
            return (
              <div key={idx} className="my-2 p-2.5 rounded-xl bg-[#06181f] border border-teal-500/20 text-xs font-mono text-teal-200 overflow-x-auto">
                {math}
              </div>
            );
          }

          // Bullet points: - item or * item
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const bulletContent = trimmed.slice(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-1.5 text-xs sm:text-sm">
                <span className="text-emerald-400 mt-1 shrink-0">•</span>
                <span className="text-slate-200">{formatInline(bulletContent)}</span>
              </div>
            );
          }

          // Numbered list: 1. item
          const numMatch = trimmed.match(/^([0-9]+)\.\s+(.*)$/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1.5 text-xs sm:text-sm">
                <span className="text-teal-400 font-bold text-xs mt-0.5 shrink-0">{numMatch[1]}.</span>
                <span className="text-slate-200">{formatInline(numMatch[2])}</span>
              </div>
            );
          }

          // Regular paragraph
          return (
            <p key={idx} className="text-xs sm:text-sm text-slate-200">
              {formatInline(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  // Helper for inline bold, italic, code pills
  const formatInline = (content: string) => {
    // Process **bold**
    const parts = content.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-bold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={pIdx} className="px-1.5 py-0.5 rounded bg-teal-950/60 border border-teal-500/30 text-teal-300 font-mono text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={pIdx} className="italic text-teal-200/90">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* 1. FLOATING CHATBOT BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-3 px-5 py-3.5 rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-400 hover:to-emerald-300 text-neutral-950 font-extrabold text-sm shadow-[0_10px_35px_rgba(20,184,166,0.5)] hover:shadow-[0_14px_45px_rgba(20,184,166,0.7)] transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer border border-emerald-300/40"
          aria-label="Open Solar AI Assistant"
        >
          {/* Luminous Pulsing Glow Avatar */}
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-1 rounded-full bg-neutral-950/20 animate-ping opacity-60 pointer-events-none" />
            <div className="w-8 h-8 rounded-full bg-neutral-950 flex items-center justify-center text-teal-400 shadow-inner">
              <Bot className="w-5 h-5 text-emerald-400" />
            </div>
            {/* Live Online Telemetry Dot */}
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-neutral-950 rounded-full" />
          </div>

          <div className="flex flex-col text-left">
            <span className="tracking-wide text-neutral-950 font-black text-sm flex items-center gap-1.5">
              Ask Solar AI
              <Sparkles className="w-4 h-4 text-neutral-950 animate-pulse" />
            </span>
            <span className="text-[10px] text-neutral-900/80 font-bold -mt-0.5">
              {metrics.plantHealthScore > 0 ? `${metrics.plantHealthScore}% Health Score` : 'SolarWatch Assistant'}
            </span>
          </div>
        </button>
      )}

      {/* 2. FLOATING CHAT WINDOW */}
      {isOpen && (
        <div
          className={`fixed z-50 flex flex-col transition-all duration-300 shadow-[0_20px_60px_rgba(0,0,0,0.65)] border border-teal-500/35 bg-[#081e26]/95 backdrop-blur-2xl rounded-3xl overflow-hidden ${
            isExpanded
              ? 'inset-4 sm:inset-10 md:inset-16 w-auto h-auto'
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-32px)] sm:w-[450px] md:w-[480px] h-[640px] max-h-[calc(100vh-60px)]'
          }`}
        >
          {/* Ambient Corner Flare */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-400/20 via-teal-400/10 to-transparent blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-amber-400/15 via-teal-500/10 to-transparent blur-3xl pointer-events-none" />

          {/* Chat Window Header */}
          <div className="relative z-10 px-5 py-4 border-b border-teal-500/30 bg-[#0a232b]/90 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400/30 to-emerald-500/30 border border-teal-400/50 flex items-center justify-center text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.3)]">
                  <Bot className="w-6 h-6 text-emerald-300" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0a232b] rounded-full" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-white tracking-wide">SolarWatch Assistant</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                    AI Active
                  </span>
                </div>
                <p className="text-[11px] text-teal-300/80 font-medium">
                  {isUsingCustomData ? '📂 Custom CSV Telemetry' : '☀️ Plant 1 Fleet Telemetry'} • {inverterSummaries.length} Inverters
                </p>
              </div>
            </div>

            {/* Window Action Buttons */}
            <div className="flex items-center gap-1.5 text-neutral-400">
              {/* Reset Chat */}
              <button
                onClick={handleResetChat}
                className="p-1.5 rounded-xl hover:bg-teal-900/40 hover:text-white transition-colors cursor-pointer"
                title="Reset Conversation"
                aria-label="Reset Conversation"
              >
                <RotateCcw className="w-4 h-4 text-teal-300" />
              </button>

              {/* Maximize / Minimize */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:block p-1.5 rounded-xl hover:bg-teal-900/40 hover:text-white transition-colors cursor-pointer"
                title={isExpanded ? 'Restore Size' : 'Maximize'}
                aria-label={isExpanded ? 'Restore Size' : 'Maximize'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4 text-teal-300" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-teal-300" />
                )}
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-rose-900/40 hover:text-rose-300 transition-colors cursor-pointer ml-1"
                title="Close Assistant"
                aria-label="Close Assistant"
              >
                <X className="w-5 h-5 text-neutral-300 hover:text-white" />
              </button>
            </div>
          </div>

          {/* Telemetry Live Bar Ribbon */}
          <div className="relative z-10 px-4 py-2 border-b border-teal-500/20 bg-[#06181f]/70 flex items-center justify-between text-[11px] overflow-x-auto gap-2 no-scrollbar">
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1 text-slate-300">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Health:</span>
                <strong className={metrics.plantHealthScore >= 90 ? 'text-emerald-400' : 'text-amber-400'}>
                  {metrics.plantHealthScore}%
                </strong>
              </span>

              <span className="text-teal-700">|</span>

              <span className="flex items-center gap-1 text-slate-300">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                <span>Loss:</span>
                <strong className="text-rose-300">{metrics.totalEnergyLossKwh.toLocaleString()} kWh</strong>
              </span>

              <span className="text-teal-700">|</span>

              <span className="flex items-center gap-1 text-slate-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Anomalies:</span>
                <strong className="text-amber-300">{metrics.totalFaultsCount}</strong>
              </span>
            </div>

            {selectedInverter !== 'all' && (
              <span className="px-2 py-0.5 rounded bg-teal-900/50 border border-teal-400/40 text-[10px] text-teal-200 font-bold shrink-0">
                Unit: {selectedInverter}
              </span>
            )}
          </div>

          {/* Messages Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 relative z-10">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[85%]">
                  {msg.sender === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-neutral-950 font-bold shrink-0 shadow-sm mb-1">
                      <Bot className="w-4 h-4 text-neutral-950" />
                    </div>
                  )}

                  <div
                    className={`p-3.5 sm:p-4 rounded-3xl shadow-md ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-neutral-950 font-semibold rounded-br-sm'
                        : 'bg-[#0a232b]/90 border border-teal-500/30 text-slate-100 rounded-bl-sm backdrop-blur-md'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <>
                        {renderFormattedText(msg.text)}

                        {/* Highlight stat badges if provided */}
                        {msg.highlightStats && msg.highlightStats.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-teal-500/25 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {msg.highlightStats.map((st, sIdx) => {
                              let borderColor = 'border-teal-500/40 text-teal-300';
                              if (st.color === 'emerald') borderColor = 'border-emerald-500/40 text-emerald-300';
                              if (st.color === 'rose') borderColor = 'border-rose-500/40 text-rose-300';
                              if (st.color === 'amber') borderColor = 'border-amber-500/40 text-amber-300';
                              if (st.color === 'blue') borderColor = 'border-cyan-500/40 text-cyan-300';

                              return (
                                <div
                                  key={sIdx}
                                  className={`px-2.5 py-1.5 rounded-xl bg-[#06181f]/80 border ${borderColor} flex flex-col`}
                                >
                                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                                    {st.label}
                                  </span>
                                  <span className="text-xs sm:text-sm font-extrabold font-mono mt-0.5">
                                    {st.value}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Message Timestamp */}
                <span className="text-[10px] text-neutral-500 px-2 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-center gap-2 max-w-[85%]">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-neutral-950 font-bold shrink-0 shadow-sm">
                  <Bot className="w-4 h-4 text-neutral-950" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-[#0a232b]/90 border border-teal-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions Collapsible Section */}
          {showQuickQuestions && (
            <div className="relative z-10 px-4 py-2 border-t border-teal-500/25 bg-[#06181f]/85">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Suggested Inquiries
                </span>
                <button
                  onClick={() => setShowQuickQuestions(false)}
                  className="text-[11px] text-neutral-400 hover:text-white"
                >
                  Hide
                </button>
              </div>

              {/* Scrollable Quick Question Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {SUGGESTED_QUESTIONS.map((qText, qIdx) => (
                  <button
                    key={qIdx}
                    onClick={() => handleSendMessage(qText)}
                    disabled={isTyping}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-[#0b2731] border border-teal-500/40 hover:border-emerald-400 hover:bg-teal-900/40 text-xs text-teal-200 hover:text-white transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {qText}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="relative z-10 p-3.5 sm:p-4 border-t border-teal-500/30 bg-[#0a232b]/95">
            {!showQuickQuestions && (
              <button
                onClick={() => setShowQuickQuestions(true)}
                className="text-[10px] text-teal-400 hover:text-teal-200 font-semibold mb-2 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Show Suggested Questions
              </button>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about plant health, anomalies, loss, AC/DC..."
                disabled={isTyping}
                className="flex-1 bg-[#06181f] border border-teal-500/35 rounded-full px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:border-teal-300 focus:ring-1 focus:ring-teal-400 disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:from-teal-900/40 disabled:to-emerald-950/40 disabled:text-neutral-600 text-neutral-950 flex items-center justify-center font-bold transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] cursor-pointer disabled:cursor-not-allowed shrink-0"
                aria-label="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
