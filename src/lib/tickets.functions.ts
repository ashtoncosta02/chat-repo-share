import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      subject: z.string().min(3).max(200),
      description: z.string().min(5).max(5000),
      category: z.string().max(50).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("tickets")
      .insert({
        user_id: userId,
        subject: data.subject,
        description: data.description,
        category: data.category ?? null,
        priority: data.priority ?? "normal",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { success: true as const, ticketId: row.id };
  });

export const getMyTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("tickets")
      .select("id, subject, status, priority, category, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tickets: data ?? [] };
  });

export const getMyTicketDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Ticket not found");
    const { data: messages } = await supabase
      .from("ticket_messages")
      .select("id, sender_role, body, created_at")
      .eq("ticket_id", data.ticketId)
      .order("created_at");
    return { ticket, messages: messages ?? [] };
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ticketId: z.string().uuid(), body: z.string().min(1).max(10000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: data.ticketId,
      sender_id: userId,
      sender_role: "customer",
      body: data.body,
    });
    if (error) throw new Error(error.message);
    await supabase.from("tickets").update({ updated_at: new Date().toISOString(), status: "open" }).eq("id", data.ticketId);
    return { success: true as const };
  });

export const getMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("profiles").select("plan").eq("user_id", userId).maybeSingle();
    return { plan: (data?.plan as "free" | "discounted" | "standard" | undefined) ?? "standard" };
  });
