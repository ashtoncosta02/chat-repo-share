// Curated ElevenLabs voice catalog for per-agent voice selection.
// Voice IDs are public, stable identifiers from ElevenLabs — safe to ship in the codebase.

import janiceAvatar from "@/assets/voices/janice.png";
import jessicaAvatar from "@/assets/voices/jessica.png";
import matildaAvatar from "@/assets/voices/matilda.png";
import aliceAvatar from "@/assets/voices/alice.png";
import brianAvatar from "@/assets/voices/brian.png";
import sophieAvatar from "@/assets/voices/sophie.png";
import georgeAvatar from "@/assets/voices/george.png";
import liamAvatar from "@/assets/voices/liam.png";

export type VoiceGender = "female" | "male";

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: VoiceGender;
  avatar: string;
}

// Curated for natural, human-sounding conversation — these are the top voices
// from ElevenLabs' "Natural Conversations" + real receptionist categories,
// chosen specifically to avoid the robotic stock-voice feel.
export const DEFAULT_VOICE_ID = "db0e7kB1Ok43TcwAEuyl"; // Janice

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "db0e7kB1Ok43TcwAEuyl",
    name: "Janice",
    description: "Warm, friendly female with a naturally engaging tone (default)",
    gender: "female",
    avatar: janiceAvatar,
  },
  {
    id: "BZgkqPqms7Kj9ulSkVzn",
    name: "Jessica",
    description: "Approachable female — friendly and bright",
    gender: "female",
    avatar: jessicaAvatar,
  },
  {
    id: "7A85ufQZSEaTbZ5eQ4f4",
    name: "Matilda",
    description: "Natural-sounding professional female voice",
    gender: "female",
    avatar: matildaAvatar,
  },
  {
    id: "gJx1vCzNCD1EQHT212Ls",
    name: "Alice",
    description: "Warm, natural female — calm and clear",
    gender: "female",
    avatar: aliceAvatar,
  },
  {
    id: "tMXujoAjiboschVOhAnk",
    name: "Sophie",
    description: "Calm, clear female — approachable and professional",
    gender: "female",
    avatar: sophieAvatar,
  },
  {
    id: "ZoiZ8fuDWInAcwPXaVeq",
    name: "Brian",
    description: "Down-to-earth American male — extremely natural",
    gender: "male",
    avatar: brianAvatar,
  },
  {
    id: "UgBBYS2sOqTuMpoF3BR0",
    name: "George",
    description: "Warm, young male — casual and professional",
    gender: "male",
    avatar: georgeAvatar,
  },
  {
    id: "7EzWGsX10sAS4c9m9cPf",
    name: "Liam",
    description: "Younger American male — friendly and natural",
    gender: "male",
    avatar: liamAvatar,
  },
];


export function getVoiceById(id: string | null | undefined): VoiceOption {
  if (!id) return VOICE_OPTIONS[0];
  return VOICE_OPTIONS.find((v) => v.id === id) ?? VOICE_OPTIONS[0];
}
