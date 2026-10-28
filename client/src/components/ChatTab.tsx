import React, { useState, useRef, useEffect } from 'react';
import { useRoom } from '../context/RoomContext.js';
import { Send, MessageSquare } from 'lucide-react';

export const ChatTab: React.FC = () => {
  const { chatMessages, ownUserId, sendMessage } = useRoom();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    sendMessage(trimmed.slice(0, 300));
    setInputText('');
  };

  const formatMessageTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message history */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-xs">No chat messages yet.</p>
            <p className="text-[11px] text-slate-600">Say hello to the room!</p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.userId === ownUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex items-center gap-1.5 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* User Profile Avatar */}
                  <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-xs shrink-0 select-none border border-white/15 bg-brand-darkSurface shadow-sm">
                    {msg.avatar ? (
                      msg.avatar.startsWith('data:image/') ? (
                        <img
                          src={msg.avatar}
                          alt={msg.username}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <span className="text-xs">{msg.avatar}</span>
                      )
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-tr from-brand-violet to-brand-pink flex items-center justify-center text-[10px] font-bold text-white">
                        {msg.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">
                    {msg.username}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                </div>
                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                    isMe
                      ? 'bg-gradient-to-r from-brand-violet to-brand-pink text-white rounded-tr-sm'
                      : 'bg-white/10 text-slate-200 border border-white/5 rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar with 300-char limiter */}
      <form onSubmit={handleSubmit} className="pt-2 mt-2 border-t border-white/5">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            maxLength={300}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="w-full pl-3 pr-10 py-2.5 bg-brand-darkSurface border border-white/10 rounded-theme text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-violet transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-1.5 p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 transition"
            aria-label="Send message"
          >
            <Send className="w-4 h-4 text-brand-pink" />
          </button>
        </div>
        <div className="flex justify-end pt-1">
          <span className="text-[10px] text-slate-500">
            {inputText.length}/300
          </span>
        </div>
      </form>
    </div>
  );
};
