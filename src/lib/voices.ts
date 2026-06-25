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

// Curated for natural, human-sounding conversation — these are the top voices
// from ElevenLabs' "Natural Conversations" + real receptionist categories,
// chosen specifically to avoid the robotic stock-voice feel.
export const DEFAULT_VOICE_ID = "hGQkZQUA5RiOXIw7P9iO"; // Kiora — most-cloned natural female

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "hGQkZQUA5RiOXIw7P9iO",
    name: "Janice",
    description: "Warm, natural female — sounds like a real receptionist (default)",
    gender: "female",
    avatar: janiceAvatar,
  },
  {
    id: "kXsOSDWolD7e9l1Z0sbH",
    name: "Jessica",
    description: "Friendly young American — natural conversational tone",
    gender: "female",
    avatar: jessicaAvatar,
  },
  {
    id: "AGYozmgYT0SJVnLKg7iN",
    name: "Matilda",
    description: "Professional American receptionist — calm and clear",
    gender: "female",
    avatar: matildaAvatar,
  },
  {
    id: "YCMgeo2Dvws6xwm7kQNN",
    name: "Alice",
    description: "British customer support — polished and clear",
    gender: "female",
    avatar: aliceAvatar,
  },
  {
    id: "wevlkhfRsG0ND2D2pQHq",
    name: "Brian",
    description: "Down-to-earth American male — extremely natural",
    gender: "male",
    avatar: brianAvatar,
  },
  {
    id: "UgBBYS2sOqTuMpoF3BR0",
    name: "Will",
    description: "Friendly young American — easygoing conversational",
    gender: "male",
    avatar: willAvatar,
  },
  {
    id: "2UMI2FME0FFUFMlUoRER",
    name: "George",
    description: "British male — warm, professional conversational",
    gender: "male",
    avatar: georgeAvatar,
  },
  {
    id: "dZcZzoYtieOVoeMG4prZ",
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
