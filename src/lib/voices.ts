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
export const DEFAULT_VOICE_ID = "g6xIsTj2HwM6VR4iXFCw"; // Janice

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "g6xIsTj2HwM6VR4iXFCw",
    name: "Janice",
    description: "Warm, natural female — sounds like a real receptionist (default)",
    gender: "female",
    avatar: janiceAvatar,
  },
  {
    id: "BZgkqPqms7Kj9ulSkVzn",
    name: "Jessica",
    description: "Friendly young American — natural conversational tone",
    gender: "female",
    avatar: jessicaAvatar,
  },
  {
    id: "7A85ufQZSEaTbZ5eQ4f4",
    name: "Matilda",
    description: "Professional American receptionist — calm and clear",
    gender: "female",
    avatar: matildaAvatar,
  },
  {
    id: "gJx1vCzNCD1EQHT212Ls",
    name: "Alice",
    description: "British customer support — polished and clear",
    gender: "female",
    avatar: aliceAvatar,
  },
  {
    id: "ZoiZ8fuDWInAcwPXaVeq",
    name: "Brian",
    description: "Down-to-earth American male — extremely natural",
    gender: "male",
    avatar: brianAvatar,
  },
  {
    id: "6YQMyaUWlj0VX652cY1C",
    name: "Will",
    description: "Friendly young American — easygoing conversational",
    gender: "male",
    avatar: willAvatar,
  },
  {
    id: "UgBBYS2sOqTuMpoF3BR0",
    name: "George",
    description: "British male — warm, professional conversational",
    gender: "male",
    avatar: georgeAvatar,
  },
  {
    id: "7EzWGsX10sAS4c9m9cPf",
    name: "Liam",
    description: "Younger American male — relaxed and natural",
    gender: "male",
    avatar: liamAvatar,
  },
];


export function getVoiceById(id: string | null | undefined): VoiceOption {
  if (!id) return VOICE_OPTIONS[0];
  return VOICE_OPTIONS.find((v) => v.id === id) ?? VOICE_OPTIONS[0];
}
