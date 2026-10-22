import { createContext, useContext, useState, type ReactNode } from "react";

export interface FunnelData {
  businessName: string;
  website: string;
  services: string;
  hours: string;
  faqs: string;
  greeting: string;
  voice: string;
  phoneChoice: "new" | "forward" | null;
  calendar: "google" | "outlook" | "skip" | null;
}

export const defaultFunnelData: FunnelData = {
  businessName: "",
  website: "",
  services: "",
  hours: "",
  faqs: "",
  greeting: "",
  voice: "janice",
  phoneChoice: null,
  calendar: null,
};

interface FunnelContextValue {
  data: FunnelData;
  update: (patch: Partial<FunnelData>) => void;
}

const FunnelContext = createContext<FunnelContextValue | null>(null);

export function FunnelProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FunnelData>(defaultFunnelData);
  const update = (patch: Partial<FunnelData>) =>
    setData((prev) => ({ ...prev, ...patch }));
  return (
    <FunnelContext.Provider value={{ data, update }}>
      {children}
    </FunnelContext.Provider>
  );
}

export function useFunnel(): FunnelContextValue {
  const ctx = useContext(FunnelContext);
  if (!ctx) throw new Error("useFunnel must be used within FunnelProvider");
  return ctx;
}
