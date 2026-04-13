import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EntityRef {
  patientId?: string;
  contactId?: string;
}

// Voice edits log
export function useVoiceEdits(entity: EntityRef) {
  const id = entity.patientId || entity.contactId;
  const field = entity.patientId ? "patient_id" : "contact_id";

  return useQuery({
    queryKey: ["voice-edits", field, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patient_voice_edits")
        .select("*")
        .eq(field, id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        patient_id: string | null;
        contact_id: string | null;
        audio_file_path: string | null;
        transcription: string | null;
        interpreted_instruction: string | null;
        fields_changed: Array<{ field: string; old_value?: string; new_value: string; reason: string }>;
        created_by: string | null;
        created_at: string;
      }>;
    },
  });
}

// Synopsis
export function useSynopsis(entity: EntityRef) {
  const id = entity.patientId || entity.contactId;
  const field = entity.patientId ? "patient_id" : "contact_id";

  return useQuery({
    queryKey: ["patient-synopsis", field, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patient_synopsis")
        .select("*")
        .eq(field, id!)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        patient_id: string | null;
        contact_id: string | null;
        content: string;
        updated_by: string | null;
        updated_at: string;
      } | null;
    },
  });
}

// Session notes
export function useSessionNotes(entity: EntityRef) {
  const id = entity.patientId || entity.contactId;
  const field = entity.patientId ? "patient_id" : "contact_id";

  return useQuery({
    queryKey: ["session-notes", field, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("patient_session_notes")
        .select("*")
        .eq(field, id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        patient_id: string | null;
        contact_id: string | null;
        content: string;
        source: string;
        audio_file_path: string | null;
        transcription: string | null;
        created_by: string | null;
        created_at: string;
      }>;
    },
  });
}

// Process voice edit mutation
export function useProcessVoiceEdit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      contactId,
      audioBase64,
      currentData,
    }: {
      patientId?: string;
      contactId?: string;
      audioBase64: string;
      currentData: Record<string, any>;
    }) => {
      const { data, error } = await supabase.functions.invoke("process-voice-edit", {
        body: {
          patient_id: patientId || null,
          contact_id: contactId || null,
          audio_base64: audioBase64,
          current_data: currentData,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        success: boolean;
        changes: Array<{ field: string; old_value?: string; new_value: string; reason: string }>;
        interpretation: string;
        transcription: string;
      };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["voice-edits"] });
      if (vars.patientId) {
        qc.invalidateQueries({ queryKey: ["patient", vars.patientId] });
        qc.invalidateQueries({ queryKey: ["patients"] });
      }
      if (vars.contactId) {
        qc.invalidateQueries({ queryKey: ["contact", vars.contactId] });
        qc.invalidateQueries({ queryKey: ["contacts"] });
      }
    },
  });
}

// Process session note mutation
export function useProcessSessionNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      contactId,
      content,
      audioBase64,
      source,
    }: {
      patientId?: string;
      contactId?: string;
      content?: string;
      audioBase64?: string;
      source?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("process-session-note", {
        body: {
          patient_id: patientId || null,
          contact_id: contactId || null,
          content: content || null,
          audio_base64: audioBase64 || null,
          source: source || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        success: boolean;
        session_note: any;
        synopsis: string;
        transcription: string | null;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-notes"] });
      qc.invalidateQueries({ queryKey: ["patient-synopsis"] });
    },
  });
}
