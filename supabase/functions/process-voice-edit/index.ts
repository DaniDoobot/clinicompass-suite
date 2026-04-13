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

    const { patient_id, contact_id, audio_base64, current_data } = await req.json();
    const entityId = patient_id || contact_id;
    const entityType = patient_id ? "patient" : "contact";
    if (!entityId) throw new Error("patient_id or contact_id is required");
    if (!audio_base64) throw new Error("audio_base64 is required");

    const { data: staffProfile } = await supabase
      .from("staff_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const createdBy = staffProfile?.id || null;

    // 1. Upload audio
    const audioBytes = Uint8Array.from(atob(audio_base64), (c) => c.charCodeAt(0));
    const filePath = `voice-edits/${entityId}/${Date.now()}.webm`;
    const { error: uploadErr } = await supabase.storage
      .from("patient-audios")
      .upload(filePath, audioBytes, { contentType: "audio/webm", upsert: false });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // 2. Transcribe
    const transcriptionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: "Eres un transcriptor profesional. Transcribe el audio del usuario de forma precisa en español. Solo devuelve la transcripción.",
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

    let transcription = "";
    if (transcriptionResp.ok) {
      const td = await transcriptionResp.json();
      transcription = td.choices?.[0]?.message?.content || "";
    }
    if (!transcription) throw new Error("No se pudo transcribir el audio");

    // 3. Use AI to interpret which fields to change
    const fieldDescriptions = `
Campos editables de la ficha del ${entityType === "patient" ? "paciente" : "contacto"}:
- first_name: nombre
- last_name: apellidos
- nif: NIF/DNI
- birth_date: fecha de nacimiento (formato YYYY-MM-DD)
- sex: sexo (hombre/mujer)
- phone: teléfono
- email: email
- address: dirección
- city: ciudad
- postal_code: código postal
- center_id: centro (necesita UUID, no disponible por voz)
- notes: observaciones generales
- source: canal de captación
- fiscal_name: nombre fiscal
- fiscal_nif: NIF fiscal
- fiscal_address: dirección fiscal
- fiscal_email: email fiscal
- fiscal_phone: teléfono fiscal
${entityType === "contact" ? "- company_name: nombre de empresa" : ""}
`;

    const currentDataStr = JSON.stringify(current_data || {}, null, 2);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Eres un asistente de CRM sanitario. Tu tarea es interpretar instrucciones de voz del usuario para modificar campos de la ficha de un ${entityType === "patient" ? "paciente" : "contacto"}.

${fieldDescriptions}

DATOS ACTUALES DE LA FICHA:
${currentDataStr}

REGLAS:
- Interpreta la instrucción de forma inteligente
- Para fechas, convierte a formato YYYY-MM-DD
- Para sexo, normaliza a "hombre" o "mujer"
- Si el usuario dice "segundo apellido", modifica last_name añadiendo/cambiando el segundo apellido
- Si el usuario dice "apellido", modifica last_name completo
- Resuelve ambigüedades razonables
- NO inventes datos que no estén en la instrucción
- Ignora campos que no puedas resolver (como center_id por UUID)`,
          },
          {
            role: "user",
            content: `Instrucción del usuario: "${transcription}"

Devuelve los cambios a aplicar.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "apply_changes",
              description: "Aplica los cambios identificados a la ficha del paciente/contacto",
              parameters: {
                type: "object",
                properties: {
                  changes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        field: { type: "string", description: "Nombre del campo a modificar" },
                        old_value: { type: "string", description: "Valor anterior del campo" },
                        new_value: { type: "string", description: "Nuevo valor a establecer" },
                        reason: { type: "string", description: "Razón del cambio según la instrucción" },
                      },
                      required: ["field", "new_value", "reason"],
                    },
                  },
                  interpretation: { type: "string", description: "Resumen de lo que se ha interpretado de la instrucción" },
                },
                required: ["changes", "interpretation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "apply_changes" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", errText);
      throw new Error("Error al procesar la instrucción con IA");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("La IA no pudo interpretar la instrucción");

    const parsed = JSON.parse(toolCall.function.arguments);
    const changes: Array<{ field: string; old_value?: string; new_value: string; reason: string }> = parsed.changes || [];
    const interpretation: string = parsed.interpretation || "";

    if (changes.length === 0) {
      // Save audit even if no changes
      await supabase.from("patient_voice_edits").insert({
        patient_id: patient_id || null,
        contact_id: contact_id || null,
        audio_file_path: filePath,
        transcription,
        interpreted_instruction: interpretation || "No se identificaron cambios",
        fields_changed: [],
        created_by: createdBy,
      });

      return new Response(
        JSON.stringify({ success: true, changes: [], interpretation, transcription }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Build update object
    const validFields = [
      "first_name", "last_name", "nif", "birth_date", "sex", "phone", "email",
      "address", "city", "postal_code", "notes", "source",
      "fiscal_name", "fiscal_nif", "fiscal_address", "fiscal_email", "fiscal_phone",
      "company_name",
    ];

    const updateObj: Record<string, any> = {};
    const appliedChanges: typeof changes = [];

    for (const change of changes) {
      if (validFields.includes(change.field)) {
        updateObj[change.field] = change.new_value || null;
        change.old_value = current_data?.[change.field] ?? null;
        appliedChanges.push(change);
      }
    }

    // 5. Apply changes to DB
    if (Object.keys(updateObj).length > 0) {
      const table = entityType === "patient" ? "patients" : "contacts";
      const { error: updateErr } = await supabase
        .from(table)
        .update(updateObj)
        .eq("id", entityId);
      if (updateErr) throw new Error(`Error al actualizar: ${updateErr.message}`);
    }

    // 6. Save audit trail
    await supabase.from("patient_voice_edits").insert({
      patient_id: patient_id || null,
      contact_id: contact_id || null,
      audio_file_path: filePath,
      transcription,
      interpreted_instruction: interpretation,
      fields_changed: appliedChanges,
      created_by: createdBy,
    });

    return new Response(
      JSON.stringify({
        success: true,
        changes: appliedChanges,
        interpretation,
        transcription,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-voice-edit error:", e);
    const status = (e as Error).message === "Unauthorized" ? 401 : 500;
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
