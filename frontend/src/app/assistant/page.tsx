'use client';

import React from 'react';
import { Mic, MicOff, Send, Bot, User, Languages, ArrowRight, Volume2, VolumeX, RefreshCcw, AlertTriangle, BatteryLow, Clock } from 'lucide-react';
import { HumanoidAvatarCanvas } from '../../components/ai/HumanoidAvatarCanvas';
import { useAppStore } from '../../stores/useAppStore';
import { LOCALES } from '../../lib/locales';
import { useAssistant } from '../../hooks/useAssistant';

export default function AssistantPage() {
  const { language, setLanguage } = useAppStore();
  const t = LOCALES[language].assistant;

  const {
    avatarState,
    inputText,
    setInputText,
    messages,
    isListening,
    voiceMode,
    pendingDraft,
    isLoading,
    messagesEndRef,
    handleToggleVoiceMode,
    toggleListening,
    handleSendMessage,
    handleCancelDraftAction,
    handleConfirmAction,
    handleClearChat,
    stopVoice
  } = useAssistant();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-4">
      {/* LEFT COL: Animated Humanoid Avatar & Controls */}
      <div className="lg:col-span-5 flex flex-col items-center justify-start space-y-6">
        <div className="w-full glass-panel p-6 rounded-3xl flex flex-col items-center text-center relative border border-slate-200 shadow-2xl">
          {/* Top Controls: Voice Mode & Language Switch */}
          <div className="w-full flex items-center justify-between mb-2">
            <button
              onClick={handleToggleVoiceMode}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                voiceMode
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-300 shadow-sm'
                  : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
              }`}
            >
              {voiceMode ? <Volume2 className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Voice Mode: {voiceMode ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-cyan-600 text-xs font-bold border border-slate-300 transition-colors"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'తెలుగు' : 'EN'}</span>
            </button>
          </div>

          <HumanoidAvatarCanvas state={avatarState} width={260} height={260} />

          <div className="space-y-1 mt-2">
            <h2 className="text-xl font-bold text-slate-900">{t.title}</h2>
            <p className="text-xs text-slate-500 max-w-xs">
              {voiceMode ? 'Voice Mode Active: Microphone input with spoken AI response' : 'Voice Mode OFF: Text input with text response'}
            </p>
          </div>

          {/* Voice Microphone Toggle */}
          <div className="pt-4 w-full flex flex-col items-center space-y-3">
            <button
              onClick={toggleListening}
              className={`flex items-center space-x-2.5 px-6 py-3 rounded-full font-bold text-sm transition-all transform hover:scale-105 shadow-xl ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-slate-900 animate-pulse shadow-red-500/30'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-900 shadow-cyan-500/25'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span>{isListening ? t.listening : 'Tap to Speak (Voice Input)'}</span>
            </button>

            {/* Stop Voice Button (Visible only when AI is speaking) */}
            {avatarState === 'speaking' && (
              <button
                onClick={stopVoice}
                className="flex items-center space-x-2 px-6 py-2.5 rounded-full font-bold text-sm bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300 transition-all shadow-md animate-fade-in"
              >
                <VolumeX className="w-4 h-4" />
                <span>Stop AI Voice</span>
              </button>
            )}
          </div>
        </div>


        {/* Quick Suggestion Chips */}
        <div className="w-full space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Suggested Prompts</span>
          <div className="flex flex-col space-y-2">
            {t.quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="text-left p-3 rounded-xl bg-white/80 hover:bg-slate-100 border border-slate-200 hover:border-cyan-500/40 text-xs text-slate-700 hover:text-slate-900 transition-all flex items-center justify-between group"
              >
                <span>"{prompt}"</span>
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COL: Chat Transcript & Confirmation Cards */}
      <div className="lg:col-span-7 flex flex-col h-[680px] glass-panel rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-200 bg-white/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Humanoid Conversation Transcript</h3>
              <p className="text-xs text-emerald-400 font-medium">Bilingual Context Active ({language.toUpperCase()})</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {avatarState === 'speaking' && (
              <button 
                onClick={stopVoice}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                title="Stop AI Voice"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Stop Voice</span>
              </button>
            )}
            <button 
              onClick={handleClearChat}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
              title="Start New Conversation"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isQuotaError = !isUser && msg.content.includes('AI_QUOTA_EXCEEDED');

            // Parse the quota message to extract clean text
            const getQuotaText = (content: string) => {
              const parts = content.split('::');
              return parts.length >= 3 ? parts[2] : content;
            };

            if (isQuotaError) {
              return (
                <div key={msg.id} className="flex space-x-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-300 text-orange-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="max-w-md rounded-2xl rounded-bl-none overflow-hidden shadow-lg border border-orange-200">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 flex items-center space-x-2">
                      <BatteryLow className="w-4 h-4 text-white" />
                      <span className="text-white text-xs font-bold tracking-wide uppercase">AI Limit Reached</span>
                    </div>
                    {/* Body */}
                    <div className="bg-orange-50 px-4 py-3 space-y-2">
                      <p className="text-orange-900 text-sm leading-relaxed">{getQuotaText(msg.content)}</p>
                      <div className="flex items-center space-x-1.5 text-orange-600 text-xs pt-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Powered by Google Gemini AI — Daily free quota exhausted. Fallback engine is active.</span>
                      </div>
                    </div>
                    <span className="block text-[10px] text-orange-400 px-4 pb-2">{msg.timestamp}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-cyan-600/30 border border-cyan-500/40 text-cyan-400 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-md p-4 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-cyan-600 text-slate-900 rounded-br-none shadow-md shadow-cyan-600/20'
                      : 'bg-white/90 text-slate-900 border border-slate-200 rounded-bl-none shadow-lg'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                  <span className={`block text-[10px] mt-2 ${isUser ? 'text-cyan-200' : 'text-slate-500'}`}>
                    {msg.timestamp}
                  </span>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}



          {isLoading && (
            <div className="flex space-x-3 items-center text-slate-500 text-xs italic">
              <div className="w-8 h-8 rounded-full bg-cyan-600/20 flex items-center justify-center animate-spin">
                <Bot className="w-4 h-4 text-cyan-400" />
              </div>
              <span>{t.processing}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Text Input Bar */}
        <div className="p-3 border-t border-slate-200 bg-white/90">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t.placeholder}
              className="flex-1 bg-slate-50 text-slate-900 placeholder-slate-500 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-cyan-500 text-sm"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold transition-colors shadow-md"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
