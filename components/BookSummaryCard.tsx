import React from 'react';
import { BookOpenIcon } from './icons/BookOpenIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { RecordDealIcon } from './icons/RecordDealIcon.tsx';
import { CopyrightIcon } from './icons/CopyrightIcon.tsx';
import { PublishingIcon } from './icons/PublishingIcon.tsx';
import { LinkIcon } from './icons/LinkIcon.tsx';

interface BookSummaryCardProps {
  onActionClick: () => void;
  isLoading: boolean;
}

const KeyConcept: React.FC<{ icon: React.ElementType; label: string }> = ({ icon: Icon, label }) => (
  <div className="flex items-center gap-3">
    <div className="flex-shrink-0 bg-brand-navy/10 dark:bg-blue-400/20 p-2 rounded-full">
      <Icon className="w-5 h-5 text-brand-navy dark:text-blue-400" />
    </div>
    <span className="font-medium text-sm text-foreground">{label}</span>
  </div>
);

const ResourceLink: React.FC<{ href: string; label: string }> = ({ href, label }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-foreground/70 hover:text-brand-purple dark:hover:text-violet-400 transition-colors group">
        <LinkIcon className="w-4 h-4 text-foreground/50 group-hover:text-brand-purple dark:group-hover:text-violet-400 transition-colors" />
        <span>{label}</span>
    </a>
);


const BookSummaryCard: React.FC<BookSummaryCardProps> = ({ onActionClick, isLoading }) => {
  return (
    <div className="mb-10 bg-surface border-2 border-brand-orange/50 rounded-2xl flex flex-col animate-fade-in-up shadow-lg overflow-hidden">
      <div className="p-6 bg-brand-orange/5 dark:bg-brand-orange/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-shrink-0 bg-brand-orange/10 dark:bg-brand-orange/20 p-3 rounded-full border border-brand-orange/20">
                <BookOpenIcon className="w-7 h-7 text-brand-orange" />
            </div>
            <div className="flex-1 text-left">
                <h4 className="font-bold text-lg text-foreground">Deep Dive: 'All About the Music Business'</h4>
                <p className="text-sm text-foreground/70 mt-1">Unlock key takeaways from the industry's essential guide by Donald S. Passman.</p>
            </div>
        </div>
      </div>
      
      <div className="p-6 grid md:grid-cols-2 gap-8"></div>