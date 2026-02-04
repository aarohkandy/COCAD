import React, { useState, useRef } from 'react';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSubmit, disabled }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSubmit(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Describe the part you want to create..."
        disabled={disabled}
        rows={3}
        className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={!message.trim() || disabled}
        className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      </button>
    </form>
  );
};
