import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { patient_id, contact_id, content, audio_base64, source } = await req.json();
    const entityId = patient_id || contact_id;
    if (!entityId) throw new Error("patient_id or contact_id is required");
    if (!content && !audio_base64) throw new Error("content or audio_base64 is required");

    const { data: staffProfile } = await supabase
      .from("staff_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const createdBy = staffProfile?.id || null;

    let sessionContent = content || "";
    let transcription: string | null = null;
    let audioPath: string | null = null;

    // If voice: transcribe and optionally structure
    if (audio_base64) {
      // Upload audio
      const audioBytes = Uint8Array.from(atob(audio_base64), (c) => c.charCodeAt(0));
      audioPath = `sessions/${entityId}/${Date.now()}.webm`;
      const { error: uploadErr } = await supabase.storage
        .from("patient-audios")
        .upload(audioPath, audioBytes, { contentType: "audio/webm", upsert: false });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      // Transcribe
      const tResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "Eres un transcriptor médico profesional. Transcribe el audio de forma precisa en español. Solo devuelve la transcripción.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe este audio:" },
                { type: "input_audio", input_audio: { data: audio_base64, format: "wav" } },
              ],
            },
          ],
        }),
      });

      if (tResp.ok) {
        const td = await tResp.json();
        transcription = td.choices?.[0]?.message?.content || "";
      }
      if (!transcription) throw new Error("No se pudo transcribir el audio");

      // Structure the transcription
      const structResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Eres un asistente clínico. Limpia y estructura la transcripción de una sesión clínica.
REGLAS:
- Elimina muletillas y lenguaje coloquial
- Mantén tono profesional y clínico
- Preserva toda la información relevante
- Organiza en párrafos claros
- NO inventes información
- Devuelve solo el contenido limpio`,
            },
            {
              role: "user",
              content: `Transcripción de la sesión:\n${transcription}\n\nDevuelve la versión limpia y estructurada:`,
            },
          ],
        }),
      });

      if (structResp.ok) {
        const sd = await structResp.json();
        sessionContent = sd.choices?.[0]?.message?.content || transcription;
      } else {
        sessionContent = transcription;
      }
    }

    // Save session note
    const { data: sessionNote, error: insertErr } = await supabase
      .from("patient_session_notes")
      .insert({
        patient_id: patient_id || null,
        contact_id: contact_id || null,
        content: sessionContent,
        source: source || (audio_base64 ? "voz" : "manual"),
        audio_file_path: audioPath,
        transcription,
        created_by: createdBy,
      })
      .select()
      .single();
    if (insertErr) throw new Error(`Error al guardar sesión: ${insertErr.message}`);

    // Update synopsis
    // Get current synopsis
    const entityField = patient_id ? "patient_id" : "contact_id";
    let { data: synopsis } = await supabase
      .from("patient_synopsis")
      .select("*")
      .eq(entityField, entityId)
      .maybeSingle();

    const currentSynopsis = synopsis?.content || "";

    // Get recent sessions for context (last 5)
    const { data: recentSessions } = await supabase
      .from("patient_session_notes")
      .select("content, created_at")
      .eq(entityField, entityId)
      .order("created_at", { ascending: false })
      .limit(5);

    const sessionsContext = (recentSessions || [])
      .map((s: any) => `[${s.created_at}] ${s.content}`)
      .join("\n\n");

    // Generate new synopsis
    const synResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Eres un asistente clínico. Genera una sinopsis global del estado del paciente.

REGLAS:
- Máximo 5-10 líneas
- Sintetiza SOLO lo más importante y reciente
- Prioriza información clínicamente relevante
- Omite detalles antiguos si ya no son relevantes
- Mantén tono profesional y conciso
- NO uses títulos ni formato markdown
- Escribe en párrafos cortos o puntos clave
- Si hay evolución, destaca el progreso
- Devuelve SOLO la sinopsis`,
          },
          {
            role: "user",
            content: `SINOPSIS ACTUAL:
${currentSynopsis || "(Sin sinopsis previa)"}

ÚLTIMAS SESIONES:
${sessionsContext}

NUEVA SESIÓN AÑADIDA:
${sessionContent}

Genera la sinopsis actualizada:`,
          },
        ],
      }),
    });

    let newSynopsis = currentSynopsis;
    if (synResp.ok) {
      const synData = await synResp.json();
      newSynopsis = synData.choices?.[0]?.message?.content || currentSynopsis;
    }

    // Upsert synopsis
    if (synopsis) {
      await supabase
        .from("patient_synopsis")
        .update({ content: newSynopsis, updated_by: createdBy })
        .eq("id", synopsis.id);
    } else {
      const insertData: any = { content: newSynopsis, updated_by: createdBy };
      if (patient_id) insertData.patient_id = patient_id;
      if (contact_id) insertData.contact_id = contact_id;
      await supabase.from("patient_synopsis").insert(insertData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_note: sessionNote,
        synopsis: newSynopsis,
        transcription,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-session-note error:", e);
    const status = (e as Error).message === "Unauthorized" ? 401 : 500;
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
