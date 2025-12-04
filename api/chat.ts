import type { VercelRequest, VercelResponse } from '@vercel/node';
// Fix: Removed 'Role' from this import as it's not exported by the library.
import { GoogleGenAI, Part, Content } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../constants.tsx'; // Adjust path as needed
// Fix: Added 'Role' to this import, as it is defined in the local types file.
import { type Message, type AppPart, Role } from '../types.ts'; // Adjust path as needed

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
    
    // Ensure the last message is from the user
    if(filteredMessages[filteredMessages.length-1].role !== Role.User){
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