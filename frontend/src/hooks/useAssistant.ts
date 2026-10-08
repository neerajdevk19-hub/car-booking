'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  bookingDraft?: any;
}

export function useAssistant() {
  const { language, token, setActiveBookingId } = useAppStore();
  
  const [avatarState, setAvatarState] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'awaiting_confirmation'>('idle');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState<boolean>(true);
  const [pendingDraft, setPendingDraft] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchedHistory, setHasFetchedHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/v1/agent/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success && data.conversations && data.conversations.length > 0) {
          const recentConv = data.conversations[0];
          setConversationId(recentConv.id);
          
          if (recentConv.messages && recentConv.messages.length > 0) {
             const loadedMsgs = recentConv.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
             }));
             setMessages(loadedMsgs);
             
             if (recentConv.bookingContext) {
               try {
                 const ctx = JSON.parse(recentConv.bookingContext);
                 if (ctx.state === 'AWAITING_CONFIRMATION') {
                    setPendingDraft(ctx);
                    setAvatarState('awaiting_confirmation');
                 }
               } catch (e) {}
             }
             return;
          }
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
      
      const welcomeText = language === 'te'
        ? 'నమస్కారం! నేను మీ రైడ్AI హ్యూమనోయిడ్ ఏజెంట్‌ను. మీకు ఎలాంటి క్యాబ్ సహాయం కావాలి?'
        : 'Hello! I am your RideAI Humanoid Agent. How can I help you with your cab booking today?';

      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: welcomeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setHasFetchedHistory(true);
    };
    
    if (token && !hasFetchedHistory) {
      fetchHistory();
    }
  }, [language, token, hasFetchedHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'te' ? 'te-IN' : 'en-US';
    utterance.rate = 1.0;
    utterance.onstart = () => setAvatarState('speaking');
    utterance.onend = () => setAvatarState(pendingDraft ? 'awaiting_confirmation' : 'idle');
    utterance.onerror = () => setAvatarState('idle');
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleVoiceMode = () => {
    const nextMode = !voiceMode;
    setVoiceMode(nextMode);
    if (!nextMode) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsListening(false);
      setAvatarState('idle');
    }
  };

  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in your browser. Please type your query.');
      return;
    }
    if (!voiceMode) setVoiceMode(true);
    if (isListening) {
      setIsListening(false);
      setAvatarState('idle');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'te' ? 'te-IN' : 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setAvatarState('listening');
      };
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        setAvatarState('processing');
        if (transcript) handleSendMessage(transcript, true);
      };
      recognition.onerror = (event: any) => {
        setIsListening(false);
        setAvatarState('error');
        const errorMsg = language === 'te' 
          ? 'క్షమించండి, మీ వాయిస్ నాకు సరిగ్గా అర్థం కాలేదు. దయచేసి మళ్లీ చెప్పండి.' 
          : 'Sorry, I couldn\'t understand that. Could you please repeat?';
        setMessages((prev) => [...prev, {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        if (voiceMode) speakText(errorMsg);
        setTimeout(() => setAvatarState('idle'), 2000);
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
      setAvatarState('idle');
    }
  };

  const handleSendMessage = async (textToSend?: string, isVoiceInput: boolean = false) => {
    const query = textToSend || inputText;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsLoading(true);
    setAvatarState('processing');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/v1/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: query, conversationId, language })
      });

      const data = await res.json();

      if (data.success) {
        if (data.conversationId) setConversationId(data.conversationId);

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          bookingDraft: data.bookingDraft
        };

        setMessages((prev) => [...prev, aiMsg]);

        if (data.pendingAction === 'CONFIRM_BOOKING' || data.bookingDraft?.state === 'AWAITING_CONFIRMATION') {
          setPendingDraft(data.bookingDraft);
          setAvatarState('awaiting_confirmation');
        } else {
          setPendingDraft(null);
          setAvatarState('speaking');
        }

        if (data.activeBookingId) setActiveBookingId(data.activeBookingId);

        if (isVoiceInput) {
          setAvatarState('speaking');
          speakText(data.response);
        } else {
          setAvatarState(data.bookingDraft?.state === 'AWAITING_CONFIRMATION' ? 'awaiting_confirmation' : 'idle');
        }
      } else {
        throw new Error(data.message || 'AI Response Error');
      }
    } catch (err: any) {
      console.error('Agent chat error:', err);
      const networkErrorMsg = language === 'te'
        ? 'సర్వర్ లేదా ఇంటర్నెట్ తో సమస్య ఉంది (Network Error). దయచేసి కాసేపు ఆగి ప్రయత్నించండి.'
        : 'I am having trouble connecting to the server (Network Error). Please check your internet connection and try again.';
      setMessages((prev) => [...prev, {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        content: networkErrorMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setAvatarState('error');
      if (isVoiceInput) speakText(networkErrorMsg);
      setTimeout(() => setAvatarState('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelDraftAction = () => {
    handleSendMessage(language === 'te' ? 'రద్దు చేయి' : 'Cancel draft');
    setPendingDraft(null);
  };

  const handleConfirmAction = () => {
    handleSendMessage(language === 'te' ? 'అవును, బుక్ చేయి' : 'Yes, confirm booking');
  };

  const handleClearChat = async () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (conversationId) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        await fetch(`${apiUrl}/api/v1/agent/conversations/${conversationId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {}
    }
    setConversationId(null);
    setPendingDraft(null);
    setAvatarState('idle');
    const welcomeText = language === 'te'
      ? 'నమస్కారం! నేను మీ రైడ్AI హ్యూమనోయిడ్ ఏజెంట్‌ను. మీకు ఎలాంటి క్యాబ్ సహాయం కావాలి?'
      : 'Hello! I am your RideAI Humanoid Agent. How can I help you with your cab booking today?';
    setMessages([{
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: welcomeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const stopVoice = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setAvatarState('idle');
    }
  };

  return {
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
  };
}
