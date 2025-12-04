import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Part, Content } from '@google/genai';
import { type Message, Role, type ChatSession, type User, AppPart, TextPart, FilePart } from './types.ts';
import { SYSTEM_INSTRUCTION, TOPIC_SUGGESTIONS, TOOL_SUGGESTIONS, ALL_ABOUT_MUSIC_BUSINESS_SUMMARY } from './constants.tsx';
import Header from './components/Header.tsx';
import ChatMessage from './components/ChatMessage.tsx';
import ChatInput from './components/ChatInput.tsx';
import TopicButton from './components/TopicButton.tsx';
import { LoadingIcon } from './components/icons/LoadingIcon.tsx';
import HistorySidebar from './components/HistorySidebar.tsx';
import SignUpBanner from './components/SignUpBanner.tsx';
import SignUpModal from './components/SignUpModal.tsx';
import LoginModal from './components/LoginModal.tsx';
import Auth from './components/Auth.tsx';
import FollowUpPrompts from './components/FollowUpPrompts.tsx';
import { SparklesIcon } from './components/icons/SparklesIcon.tsx';
import { CalculatorIcon } from './components/icons/CalculatorIcon.tsx';
import BookSummaryCard from './components/BookSummaryCard.tsx';

const RECOVERY_SESSION_KEY = 'indie-coach-recovery-data';

// Helper function to get the API key safely, preventing a startup ReferenceError.
const getApiKey = (): string => {
  if (typeof process === 'undefined' || !process.env || !process.env.API_KEY) {
    throw new Error("[GoogleGenerativeAI Error]: API key not found. Please check your environment configuration.");
  }
  return process.env.API_KEY;
};

// Helper function to convert a File to a Base64 string
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = (error) => reject(error);
    });
};

// Helper to convert internal AppPart[] to SDK-compatible Part[]
const appPartsToApiParts = (parts: AppPart[]): Part[] => {
    return parts.map(part => {
        if (part.type === 'text') {
            return { text: part.text };
        }
        return { inlineData: { mimeType: part.file.mimeType, data: part.file.data }};
    });
};

// Helper to convert the app's message history to the SDK's Content[] format
const appMessagesToApiContents = (messages: Message[]): Content[] => {
    return messages.map(msg => ({
        role: msg.role,
        parts: appPartsToApiParts(msg.parts)
    }));
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [view, setView] = useState<'auth' | 'chat'>('auth');
  const [followUpPrompts, setFollowUpPrompts] = useState<string[]>([]);
  const [showBookSummary, setShowBookSummary] = useState(true);
  const [guestMessageCount, setGuestMessageCount] = useState<number>(() => {
    const savedUser = localStorage.getItem('indie-coach-active-user');
    if (savedUser) return 0;
    const count = sessionStorage.getItem('guestMessageCount');
    return count ? parseInt(count, 10) : 0;
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const authenticateUser = useCallback((userData: User, guestMessages: Message[] = []) => {
    setIsAuthenticated(true);
    setUser(userData);
    setView('chat');

    const savedHistory = localStorage.getItem(`indie-coach-history-${userData.email}`);
    let parsedHistory: ChatSession[] = [];
    if (savedHistory) {
      try {
        const historyData = JSON.parse(savedHistory);
        if (Array.isArray(historyData)) {
          parsedHistory = historyData;
        }
      } catch (e) {
        console.error("Failed to parse chat history from localStorage, resetting.", e);
      }
    }
    
    setChatHistory(parsedHistory);
    
    if (guestMessages.length > 0) {
        const firstUserMessage = guestMessages.find(m => m.role === Role.User);
        const textPart = firstUserMessage?.parts.find(p => p.type === 'text') as TextPart | undefined;
        const filePart = firstUserMessage?.parts.find(p => p.type === 'file') as FilePart | undefined;
        const title = textPart?.text.substring(0, 40) || filePart?.file.name.substring(0, 40) || 'Imported Chat';

        const newChatSession: ChatSession = {
            id: Date.now().toString(),
            title,
            messages: guestMessages,
        };
        parsedHistory = [newChatSession, ...parsedHistory];
        setChatHistory(parsedHistory);
        setMessages(guestMessages);
        setActiveChatId(newChatSession.id);
        return;
    }

    // Check for session recovery data
    const recoveryDataString = sessionStorage.getItem(RECOVERY_SESSION_KEY);
    if (recoveryDataString) {
        try {
            const recoveryData = JSON.parse(recoveryDataString);
            if (recoveryData.messages && recoveryData.activeChatId && parsedHistory.some((chat: ChatSession) => chat.id === recoveryData.activeChatId)) {
                setActiveChatId(recoveryData.activeChatId);
                setMessages(recoveryData.messages);
                setFollowUpPrompts([]);
                return;
            }
        } catch(e) { console.error("Failed to parse recovery data", e); }
    }
    
    // Default for authenticated users: start with a fresh chat screen
    setActiveChatId(null);
    setMessages([]);

  }, []);


  useEffect(() => {
    const activeUserString = localStorage.getItem('indie-coach-active-user');
    if (activeUserString) {
      try {
        const activeUser = JSON.parse(activeUserString);
        if (activeUser && activeUser.email) {
            authenticateUser(activeUser);
        } else {
            throw new Error("Parsed user data is invalid.");
        }
      } catch (e) {
        console.error("Failed to parse active user from localStorage, logging out.", e);
        localStorage.removeItem('indie-coach-active-user');
        setView('auth');
      }
    } else {
        // Handle guest session recovery
        const recoveryDataString = sessionStorage.getItem(RECOVERY_SESSION_KEY);
        if (recoveryDataString) {
             try {
                const recoveryData = JSON.parse(recoveryDataString);
                if (recoveryData.messages && !recoveryData.activeChatId) { // Check it's a guest session
                    setMessages(recoveryData.messages);
                    setFollowUpPrompts([]);
                    setView('chat');
                }
             } catch(e) { console.error("Failed to parse guest recovery data", e); }
        }
    }
  }, [authenticateUser]);
  
  // Effect for saving session for crash recovery
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      const recoveryData = {
        activeChatId: isAuthenticated ? activeChatId : null,
        messages: messages,
      };
      sessionStorage.setItem(RECOVERY_SESSION_KEY, JSON.stringify(recoveryData));
    }
  }, [messages, activeChatId, isAuthenticated, isLoading]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const historyToSave = chatHistory.map(session => ({
        ...session,
        messages: session.messages.map(message => ({
            ...message,
            parts: message.parts.map(part => {
                if (part.type === 'file') {
                    // Omit the large 'data' field from history to keep localStorage size down
                    const { data, ...restOfFile } = part.file;
                    return { ...part, file: restOfFile };
                }
                return part;
            })
        }))
      }));
      localStorage.setItem(`indie-coach-history-${user.email}`, JSON.stringify(historyToSave));
    }
  }, [chatHistory, isAuthenticated, user]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, followUpPrompts]);

  const handleSendMessage = async (text: string, file?: File | null, isBookSummaryPrompt?: boolean) => {
    setFollowUpPrompts([]);
    if (isBookSummaryPrompt) {
        setShowBookSummary(false);
    }
    const isChatLocked = !isAuthenticated && guestMessageCount >= 3;
    if ((!text.trim() && !file) || isLoading || isChatLocked) return;
    
    const userParts: AppPart[] = [];
    if (text.trim()) {
        userParts.push({ type: 'text', text });
    }
    if (file) {
        const base64Data = await fileToBase64(file);
        userParts.push({ type: 'file', file: { name: file.name, mimeType: file.type, data: base64Data }});
    }

    const userMessage: Message = { 
        role: Role.User, 
        parts: userParts, 
        timestamp: Date.now(),
    };
    
    const aiMessagePlaceholder: Message = { role: Role.AI, parts: [{ type: 'text', text: '' }], timestamp: Date.now() };
    const currentMessages = [...messages, userMessage];
    setMessages([...currentMessages, aiMessagePlaceholder]);
    setIsLoading(true);

    let currentChatId = activeChatId;
    if (isAuthenticated && !currentChatId) {
      currentChatId = Date.now().toString();
      setActiveChatId(currentChatId);
      const textPart = userMessage.parts.find(p => p.type === 'text') as TextPart | undefined;
      const filePart = userMessage.parts.find(p => p.type === 'file') as FilePart | undefined;
      const title = textPart?.text.substring(0, 30) || filePart?.file.name.substring(0, 30) || 'New Chat';
      const newChatSession: ChatSession = { id: currentChatId, title, messages: currentMessages }; // History saved after response
      setChatHistory(prev => [newChatSession, ...prev]);
    } else if (isAuthenticated && currentChatId) {
      setChatHistory(prev => prev.map(chat =>
        chat.id === currentChatId ? { ...chat, messages: currentMessages } : chat
      ));
    }

    try {
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      
      const messagesForApi = [...currentMessages];

      if (isBookSummaryPrompt) {
          messagesForApi.unshift({ role: Role.User, parts: [{ type: 'text', text: `Use the following book summary to answer my question:\n\n${ALL_ABOUT_MUSIC_BUSINESS_SUMMARY}` }], timestamp: Date.now() });
          messagesForApi.unshift({ role: Role.AI, parts: [{ type: 'text', text: "Got it. I'll use the summary to answer. What's your question?" }], timestamp: Date.now() });
      }

      const contents = appMessagesToApiContents(messagesForApi);

      const stream = await ai.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: contents,
          config: { 
            systemInstruction: SYSTEM_INSTRUCTION,
          }
      });
      
      let fullResponseText = '';
      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if(chunkText) {
          fullResponseText += chunkText;
          setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if(lastMessage.role === Role.AI) {
                  const cleanedText = fullResponseText.replace(/\[SUGGESTIONS\].*?/, '');
                  lastMessage.parts = [{ type: 'text', text: cleanedText }];
              }
              return newMessages;
          });
        }
      }
      
      const suggestionRegex = /\[SUGGESTIONS\](.*?)\[\/SUGGESTIONS\]/;
      const suggestionMatch = fullResponseText.match(suggestionRegex);
      
      let finalResponseText = fullResponseText;
      if (suggestionMatch && suggestionMatch[1]) {
        const suggestions = suggestionMatch[1].split('|').map(s => s.trim()).filter(Boolean);
        setFollowUpPrompts(suggestions);
        finalResponseText = fullResponseText.replace(suggestionRegex, '').trim();
      }

      const finalAIMessage: Message = { role: Role.AI, parts: [{ type: 'text', text: finalResponseText }], timestamp: Date.now() };
      
      const finalMessages = [...currentMessages, finalAIMessage];
      setMessages(finalMessages);

      if (isAuthenticated && currentChatId) {
        setChatHistory(prev => prev.map(chat =>
          chat.id === currentChatId ? { ...chat, messages: finalMessages } : chat
        ));
      }
      
      if (!isAuthenticated) {
        const newCount = guestMessageCount + 1;
        setGuestMessageCount(newCount);
        sessionStorage.setItem('guestMessageCount', newCount.toString());
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      const errorMsg: Message = { role: Role.AI, parts: [{ type: 'text', text: `Sorry, something went wrong: ${errorMessage}` }], timestamp: Date.now() };
      setMessages(prev => [...prev.slice(0, -1), errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const openSignUpModal = () => { setIsLoginModalOpen(false); setIsSignUpModalOpen(true); };
  const openLoginModal = () => { setIsSignUpModalOpen(false); setIsLoginModalOpen(true); };
  const closeAllModals = () => { setIsSignUpModalOpen(false); setIsLoginModalOpen(false); };

  const handleCompleteSignUp = (userData: User): string | null => {
    const usersString = localStorage.getItem('indie-coach-users');
    let users: User[] = [];
    if (usersString) {
        try {
            const parsedUsers = JSON.parse(usersString);
            if(Array.isArray(parsedUsers)) {
                users = parsedUsers;
            }
        } catch (e) {
            console.error("Failed to parse users list, starting fresh.", e);
        }
    }

    if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        return "An account with this email already exists. Please log in.";
    }
    
    users.push(userData);
    localStorage.setItem('indie-coach-users', JSON.stringify(users));
    localStorage.setItem('indie-coach-active-user', JSON.stringify(userData));
    
    const guestMessagesToTransfer = [...messages];
    authenticateUser(userData, guestMessagesToTransfer);
    
    sessionStorage.removeItem('guestMessageCount');
    sessionStorage.removeItem(RECOVERY_SESSION_KEY);
    setGuestMessageCount(0);

    setIsSignUpModalOpen(false);
    return null;
  };
  
  const handleLogin = (email: string): boolean => {
    const usersString = localStorage.getItem('indie-coach-users');
    let users: User[] = [];
    if (usersString) {
        try {
            const parsedUsers = JSON.parse(usersString);
            if(Array.isArray(parsedUsers)) {
                users = parsedUsers;
            }
        } catch (e) {
            console.error("Failed to parse users list for login.", e);
        }
    }
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (foundUser) {
        localStorage.setItem('indie-coach-active-user', JSON.stringify(foundUser));
        authenticateUser(foundUser);
        setIsLoginModalOpen(false);
        return true;
    }
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('indie-coach-active-user');
    sessionStorage.removeItem(RECOVERY_SESSION_KEY);
    setIsAuthenticated(false);
    setUser(null);
    setMessages([]);
    setActiveChatId(null);
    setChatHistory([]);
    setView('auth');
  };

  const handleGuestMode = () => {
    setView('chat');
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setFollowUpPrompts([]);
    setShowBookSummary(true);
    setSidebarOpen(false);
    sessionStorage.removeItem(RECOVERY_SESSION_KEY);
  };

  const handleSelectChat = (id: string, history: ChatSession[] = chatHistory) => {
    const selectedChat = history.find(chat => chat.id === id);
    if (selectedChat) {
      setActiveChatId(id);
      setMessages(selectedChat.messages);
      setFollowUpPrompts([]);
      setShowBookSummary(false);
      if (user) {
        localStorage.setItem(`indie-coach-last-active-${user.email}`, id);
      }
    }
    setSidebarOpen(false);
  };
  
  const handleDeleteChat = (id: string) => {
    setChatHistory(prev => prev.filter(chat => chat.id !== id));
    if (activeChatId === id) {
        handleNewChat();
    }
  }

  const handleTopicClick = (prompts: string[]) => {
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    handleSendMessage(randomPrompt, null, false);
  };

  const handleBookSummaryAction = () => {
      handleSendMessage("Break down the key concepts from 'All About the Music Business' for me.", null, true);
  };

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const isChatLocked = !isAuthenticated && guestMessageCount >= 3;

  return (
    <>
      {view === 'auth' ? (
        <Auth onSignUpClick={openSignUpModal} onLoginClick={openLoginModal} onGuestClick={handleGuestMode} />
      ) : (
        <div className="flex h-screen bg-background text-foreground transition-colors duration-300">
          <HistorySidebar
            isOpen={isSidebarOpen}
            onClose={() => setSidebarOpen(false)}
            chatHistory={chatHistory}
            activeChatId={activeChatId}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
            onLogout={handleLogout}
            isAuthenticated={isAuthenticated}
            onSignUp={openSignUpModal}
          />
          <div className="flex flex-col flex-1">
            <Header theme={theme} toggleTheme={toggleTheme} onMenuClick={() => setSidebarOpen(true)} />
            <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
              <div className="max-w-4xl mx-auto w-full">
                {messages.length === 0 && !isLoading && (
                  <div className="text-center animate-fade-in-up">
                    <h2 className="text-2xl md:text-3xl font-bold mb-3">Welcome to Indie Coach</h2>
                    <p className="text-base text-foreground/70 mb-10 max-w-xl mx-auto">Your 24/7 music industry mentor. How can I help you grow today?</p>
                    
                    {showBookSummary && (
                        <BookSummaryCard onActionClick={handleBookSummaryAction} isLoading={isLoading} />
                    )}

                    <div className="text-left">
                      <h3 className="flex items-center gap-2 text-lg font-semibold mb-4 text-foreground">
                        <SparklesIcon className="w-5 h-5 text-brand-orange" />
                        <span>Explore Topics</span>
                      </h3>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {TOPIC_SUGGESTIONS.map((topic, index) => (
                          <TopicButton key={index} icon={topic.icon} title={topic.title} onClick={() => handleTopicClick(topic.prompts)} disabled={isLoading} />
                        ))}
                      </div>

                      <h3 className="flex items-center gap-2 text-lg font-semibold mt-12 mb-4 text-foreground">
                        <CalculatorIcon className="w-5 h-5 text-brand-orange" />
                        <span>Interactive Tools</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {TOOL_SUGGESTIONS.map((tool, index) => (
                          <TopicButton key={index} icon={tool.icon} title={tool.title} onClick={() => handleTopicClick(tool.prompts)} disabled={isLoading} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {messages.map((msg, index) => (
                    <ChatMessage 
                        key={index} 
                        message={msg} 
                        user={user} 
                        isStreaming={isLoading && index === messages.length - 1 && msg.role === Role.AI}
                    />
                ))}
                
                {isLoading && messages[messages.length - 1]?.role !== Role.AI && (
                  <div className="flex justify-start">
                    <div className="bg-surface border border-surface-border rounded-2xl p-4 max-w-[85%] animate-fade-in-up">
                      <LoadingIcon />
                    </div>
                  </div>
                )}
                
                {!isLoading && followUpPrompts.length > 0 && (
                  <FollowUpPrompts
                    prompts={followUpPrompts}
                    onPromptClick={(prompt) => handleSendMessage(prompt, null, false)}
                    isLoading={isLoading}
                  />
                )}
              </div>
            </main>
            <footer className="p-4 bg-background border-t border-surface-border">
              <div className="max-w-4xl mx-auto">
                {isChatLocked && <SignUpBanner onSignUp={openSignUpModal} />}
                <ChatInput onSendMessage={(text, file) => handleSendMessage(text, file, false)} isLoading={isLoading} isLocked={isChatLocked} />
              </div>
            </footer>
          </div>
        </div>
      )}
      <SignUpModal 
        isOpen={isSignUpModalOpen}
        onClose={closeAllModals}
        onSignUp={handleCompleteSignUp}
        onSwitchToLogin={openLoginModal}
      />
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeAllModals}
        onLogin={handleLogin}
        onSwitchToSignUp={openSignUpModal}
      />
    </>
  );
};

export default App;