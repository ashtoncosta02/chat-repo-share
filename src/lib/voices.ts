// Curated ElevenLabs voice catalog for per-agent voice selection.
// Voice IDs are public, stable identifiers from ElevenLabs — safe to ship in the codebase.

import janiceAvatar from "@/assets/voices/janice.png";
import jessicaAvatar from "@/assets/voices/jessica.png";
import matildaAvatar from "@/assets/voices/matilda.png";
import aliceAvatar from "@/assets/voices/alice.png";
import brianAvatar from "@/assets/voices/brian.png";
import willAvatar from "@/assets/voices/will.png";
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

export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Janice

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Janice",
    description: "Warm female receptionist (default)",
    gender: "female",
    avatar: janiceAvatar,
  },
  {
    id: "cgSgspJ2msm6clMCkdW9",
    name: "Jessica",
    description: "Friendly female, conversational",
    gender: "female",
    avatar: jessicaAvatar,
  },
  {
    id: "XrExE9yKIg1WjnnlVkGX",
    name: "Matilda",
    description: "Calm female, professional",
    gender: "female",
    avatar: matildaAvatar,
  },
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    name: "Alice",
    description: "British female, polished",
    gender: "female",
    avatar: aliceAvatar,
  },
  {
    id: "nPczCjzI2devNBz1zQrb",
    name: "Brian",
    description: "Deep male, authoritative",
    gender: "male",
    avatar: brianAvatar,
  },
  {
    id: "bIHbv24MWmeRgasZH58o",
    name: "Will",
    description: "Friendly male, casual",
    gender: "male",
    avatar: willAvatar,
  },
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    description: "British male, refined",
    gender: "male",
    avatar: georgeAvatar,
  },
  {
    id: "TX3LPaxmHKxFdv7VOQHJ",
    name: "Liam",
    description: "Young male, energetic",
    gender: "male",
    avatar: liamAvatar,
  },
];

export function getVoiceById(id: string | null | undefined): VoiceOption {
  if (!id) return VOICE_OPTIONS[0];
  return VOICE_OPTIONS.find((v) => v.id === id) ?? VOICE_OPTIONS[0];
}
