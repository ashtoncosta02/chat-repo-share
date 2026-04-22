// Curated ElevenLabs voice catalog for per-agent voice selection.
// Voice IDs are public, stable identifiers from ElevenLabs — safe to ship in the codebase.

export type VoiceGender = "female" | "male";

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: VoiceGender;
}

export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    description: "Warm female receptionist (default)",
    gender: "female",
  },
  {
    id: "cgSgspJ2msm6clMCkdW9",
    name: "Jessica",
    description: "Friendly female, conversational",
    gender: "female",
  },
  {
    id: "XrExE9yKIg1WjnnlVkGX",
    name: "Matilda",
    description: "Calm female, professional",
    gender: "female",
  },
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    name: "Alice",
    description: "British female, polished",
    gender: "female",
  },
  {
    id: "nPczCjzI2devNBz1zQrb",
    name: "Brian",
    description: "Deep male, authoritative",
    gender: "male",
  },
  {
    id: "bIHbv24MWmeRgasZH58o",
    name: "Will",
    description: "Friendly male, casual",
    gender: "male",
  },
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    description: "British male, refined",
    gender: "male",
  },
  {
    id: "TX3LPaxmHKxFdv7VOQHJ",
    name: "Liam",
    description: "Young male, energetic",
    gender: "male",
  },
];

export function getVoiceById(id: string | null | undefined): VoiceOption {
  if (!id) return VOICE_OPTIONS[0];
  return VOICE_OPTIONS.find((v) => v.id === id) ?? VOICE_OPTIONS[0];
}
