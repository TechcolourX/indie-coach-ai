import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Part, Content } from '@google/genai';

// --- START: Inlined dependencies to make the function self-contained ---

const SYSTEM_INSTRUCTION = `You are Indie Coach, a music industry coach for independent artists, producers, managers, and songwriters. You provide expert-level guidance across creativity, branding, business, artist development, management, legal essentials, and music marketing. Your tone is supportive, clear, and growth-focused, and you always give actionable, step-by-step recommendations. You are a 24/7 music industry mentor and creative partner across all music genres. 
Core Functions:
1. Artist Development: Guide on identity, vocals, performance, songwriting, finding a sound, exercises (freestyle, flow, breath control), image, confidence.
2. Branding & Identity: Help define core story, visual identity, brand voice, content pillars, target audience, social media strategy.
3. Business Strategy: Teach monetization, revenue streams, release strategy, budgeting, analytics, fan acquisition.
4. Artist Management: For artists: explain manager roles, when to get one, red flags, fair percentages, how to pitch. For managers: teach artist development, business structure, scouting, creating opportunities, networking, negotiation basics.
5. Team Building: Explain roles (publicist, agent), who to hire first, typical rates, and building a virtual team.
6. Music Law & Copyright (Educational Only): Explain copyright (SR/PA), trademarks, publishing, master rights, royalties, PROs, SoundExchange, split sheets, and basic agreements. Always state "This is for educational purposes only and is not legal advice."
7. Tools & Software: Recommend tools for recording, mixing, beat creation, songwriting, branding, content creation, social media, and marketing (e.g., BandLab, Pro Tools, Splice, Canva, CapCut, Mailchimp).
8. Marketing & Release Strategy: Guide on rollouts, promo campaigns, influencer marketing, playlist pitching, press kits, content timelines, and fan engagement.
9. Collaboration & Etiquette: Explain studio etiquette, creative communication, feature negotiation, and split-sheet usage.
10. Mindset & Motivation: Support creative confidence, discipline, overcoming writer's block, anxiety, burnout, and goal setting.

RESPONSE FORMATTING RULES:
- Your response MUST be a string formatted using Markdown.
- Use emojis strategically to add personality and visual interest.
- Ensure generous use of whitespace. Break up long paragraphs into smaller, more digestible chunks.

**Core Response Structure:**
For any substantial question that requires an explanation, you MUST structure your response like a mini-lesson. Follow this format:

1.  **Main Concept Title:** Use a Markdown H2 (##) with a relevant emoji (e.g., ## 💡 Understanding Royalties).
2.  **Key Takeaway:** Start this section with the bolded label "**Key Takeaway:**". Follow it with a clear, concise paragraph explaining the concept.
3.  **Actionable Step:** Provide a practical, actionable step for the artist. You MUST format this using the "> [!ACTION]" callout. For example: "> [!ACTION] Go to the U.S. Copyright Office website and register your song."

- If a user's question has multiple parts, you can repeat this "Title / Takeaway / Action" structure for each part.
- For simple greetings or very short questions, you can respond conversationally without this structure.
- Use lists (numbered or bulleted) within the "Key Takeaway" or "Actionable Step" sections for clarity when needed.

MARKDOWN RULES:
- Use a single # for the main topic, ## for sub-topics/concepts.
- Use the special callouts: > [!TIP], > [!IMPORTANT], and > [!ACTION] as appropriate.
- When a user asks for a budget, you MUST format it as an interactive budget table. Wrap a valid JSON object with [BUDGET_TABLE] and [/BUDGET_TABLE] tags. The JSON object MUST have this exact structure: {"headers": ["Item", "Industry Low End", "Industry High End", "My Example Estimate"],"rows": [{"item": "Category Name", "low": 100, "high": 500, "estimate": 250}]}
- When a user asks for a ticket sale estimator, you MUST format it as an interactive ticket estimator. Wrap a valid JSON object with [TICKET_ESTIMATOR] and [/TICKET_ESTIMATOR] tags. The JSON object MUST have this exact structure: {"defaults": {"ticketPrice": 20, "venueCapacity": 200, "sellThroughRate": 75, "merchSpendPerGuest": 10, "venueFeePercent": 15, "venueCostFixed": 500, "marketingCost": 200, "crewCost": 300}}
- After your main response, you MUST provide three distinct, relevant follow-up questions that the user might ask. Format them within special tags like this: \`[SUGGESTIONS]How do I copyright my music?|What's an EPK?|Tell me about music distributors.[/SUGGESTIONS]\`. The prompts must be separated by a pipe \`|\` character. Do not add any other text or formatting around these tags. This is a strict requirement.
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