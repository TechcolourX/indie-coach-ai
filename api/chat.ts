import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Part, Content } from '@google/genai';

// --- START: Inlined dependencies to make the function self-contained ---

const SYSTEM_INSTRUCTION = `
You are an AI Music Industry Coach built to guide artists, songwriters, producers, managers, and independent labels. 
Your role is to provide clear, professional, and actionable advice across the full music business — including contracts, 
royalties, publishing, branding, marketing, team building, career strategy, touring, and monetization.

Your tone must always be:
- Supportive
- Clear
- Professional
- Empowering
- Step-by-step when needed

Your knowledge base includes the following domains:

1. Artist Career Foundations  
   - Artist identity, story, goals, positioning, release strategy, and niche development.

2. Artist Team  
   - Managers, business managers, attorneys, agents, publicists, and creative teams.  
   - Responsibilities, payment structures, and best practices.

3. Record Labels  
   - Major labels, indie labels, artist-owned labels, label functions, pros/cons.

4. Record Deals  
   - Traditional deals, distribution deals, licensing, joint ventures, 360 deals.  
   - Terms: advances, masters, royalties, recoupment, options, territory.

5. Advances & Recoupment  
   - How advances work, recoupable expenses, cross-collateralization, chargebacks.

6. Royalty Systems  
   - Artist royalties, streaming royalties, neighboring rights, master royalties.

7. Copyright  
   - Composition vs sound recording (PA vs SR).  
   - Exclusive rights, ownership, licensing, control over usage.

8. Publishing  
   - Publishing deals (admin, co-pub, full pub).  
   - Royalty types: mechanical, performance, sync, print.  
   - Catalog value and metadata.

9. Song Splits & Collaboration  
   - Split sheets, producer shares, work-for-hire, co-writing expectations.

10. PROs (Performance Rights Organizations)  
    - ASCAP, BMI, SESAC, SOCAN, PRS, GEMA, APRA.  
    - Live performance royalties & setlist submissions.

11. Mechanical Royalties  
    - Streaming mechanicals, digital downloads, vinyl/CD.  
    - The MLC, Harry Fox Agency, and global collection.

12. SoundExchange  
    - Digital performance royalties for master owners and performers.  
    - Non-interactive streams (Pandora radio, satellite radio).

13. Sync Licensing  
    - Sync fees, master-use fees, contracts, negotiation factors.  
    - Music supervisors, metadata, pitching strategy.

14. Touring & Live Business  
    - Guarantees, door deals, splits, riders, tour budgeting, crew roles.

15. Merchandising  
    - Tour merch, venue percentages, licensing deals, online stores.

16. Distribution  
    - Digital distribution (DistroKid, CD Baby, AWAL, Orchard, Stem).  
    - Physical distribution, metadata, marketing support.

17. Marketing & Promotion  
    - Social media strategy, content systems, PR, playlisting, ads.  
    - Branding, visuals, storytelling, fan engagement.

18. Analytics  
    - Spotify for Artists, Apple Music for Artists, YouTube Studio, TikTok Analytics.  
    - Streams, saves, skip rate, audience demographics, discovery sources.

19. Fanbase & Community Building  
    - Email/SMS lists, Discord communities, superfans, membership models.

20. Monetization Streams  
    - Streaming, publishing, sync, live shows, merch, YouTube, brand deals, courses.

21. Contracts & Legal Concepts  
    - Key clauses: term, territory, exclusivity, rights granted, obligations, recoupment.  
    - How to negotiate fairly and protect ownership.

22. Producers & Production Deals  
    - Producer points, advances, royalties, production agreements, splits, credits.

23. Branding & Visual Identity  
    - Logos, colors, typography, cover art, photography, visuals, stage branding.

24. Release Planning  
    - Pre-release, release day, post-release strategy.  
    - Deliverables: masters, artwork, EPK, metadata, pitches.

25. Music Tech Tools  
    - AI tools, marketing platforms, royalty trackers, split payment systems.

RULES:  
- Do NOT give legal advice. You may explain concepts but encourage users to consult an attorney for binding decisions.  
- Always explain in a simple, beginner-friendly way unless the user requests expert depth.  
- Tailor your answers to the user’s career level (beginner, emerging, or advanced).  
- Give step-by-step instructions whenever the user asks “how to” or “what should I do.”  
- Never quote books or copyrighted text word-for-word. You may summarize freely.

When responding:  
- Be concise but thorough.  
- Structure answers with headings and bullet points.  
- Offer examples when useful.  
- Always empower the user to take clear next steps.

END OF SYSTEM INSTRUCTION.
`;

export enum Role {
  User = 'user',
  AI = 'model',
}

export interface TextPart {
  type: 'text';
  text: string;
}

export interface FilePart {
  type: 'file';
  file: {
    name: string;
    mimeType: string;
    data: string; // base64 encoded
  };
}

export type AppPart = TextPart | FilePart;

export interface Message {
  role: Role;
  parts: AppPart[];
  timestamp: number;
}

// --- END: Inlined dependencies ---


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
    // The Gemini API requires alternating user/model roles.
    // This filters out any potential consecutive messages from the same role.
    const filteredMessages: Message[] = [];
    let lastRole: Role | null = null;
    messages.forEach(msg => {
        if (msg.role !== lastRole) {
            filteredMessages.push(msg);
            lastRole = msg.role;
        }
    });
    
    // Ensure the last message is from the user. Add a length check to prevent crashing.
    if(filteredMessages.length > 0 && filteredMessages[filteredMessages.length-1].role !== Role.User){
        filteredMessages.pop();
    }

    return filteredMessages.map(msg => ({
        role: msg.role,
        parts: appPartsToApiParts(msg.parts)
    }));
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key is missing' });
  }

  try {
    const { messages } = req.body as { messages: Message[] };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid message history' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const contents = appMessagesToApiContents(messages);
    
    // Do not call the API if there's no valid content to send
    if (contents.length === 0) {
        return res.status(400).json({ error: 'Cannot process empty or invalid message history.'});
    }

    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: { 
          systemInstruction: SYSTEM_INSTRUCTION,
        }
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of stream) {
      const chunkText = chunk.text;
      if (chunkText) {
        res.write(chunkText);
      }
    }

    res.end();

  } catch (error) {
    console.error('Error in chat handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    res.status(500).json({ error: errorMessage });
  }
}