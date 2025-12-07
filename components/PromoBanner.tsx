import React from 'react';
import { BookOpenIcon } from './icons/BookOpenIcon';

interface PromoBannerProps {
  onActionClick: () => void;
  isLoading: boolean;
}

const PromoBanner: React.FC<PromoBannerProps> = ({ onActionClick, isLoading }) => {
  return (
    <div className="mb-10 p-5 bg-surface border border-surface-border rounded-2xl flex flex-col sm:flex-row items-center gap-5 animate-fade-in-up shadow-sm">
      <div className="flex-shrink-0 bg-brand-orange/10 p-3 rounded-full">
        <BookOpenIcon className="w-6 h-6 text-brand-orange" />
      </div>
      <div className="flex-1 text-center sm:text-left">
        <h4 className="font-bold text-foreground">Deep Dive: 'All About the Music Business'</h4>
        <p className="text-sm text-foreground/70 mt-1">Get a summary and key takeaways from the industry's essential guide.</p>
      </div>
      <button 
        onClick={onActionClick}
        disabled={isLoading}
        className="w-full sm:w-auto flex-shrink-0 brand-cta text-white font-bold py-2.5 px-6 rounded-xl shadow-md transform hover:scale-105"
      >
        Break It Down For Me
      </button>
    </div>
  );
};

export default PromoBanner;