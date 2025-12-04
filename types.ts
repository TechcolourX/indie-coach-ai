import { Part } from '@google/genai';

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

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

export interface User {
  firstName: string;
  lastName: string;
  email: string;
}