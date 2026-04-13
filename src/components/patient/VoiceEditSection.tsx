import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, History, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useProcessVoiceEdit, useVoiceEdits } from "@/hooks/useVoiceEdit";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  patientId?: string;
  contactId?: string;
  currentData: Record<string, any>;
}

type Step = "idle" | "recording" | "uploading" | "processing" | "done" | "error";

const stepLabels: Record<Step, string> = {
  idle: "",
  recording: "Grabando instrucción...",
  uploading: "Subiendo audio...",
  processing: "IA interpretando cambios...",
  done: "¡Cambios aplicados!",
  error: "Error al procesar",
};

const fieldLabels: Record<string, string> = {
  first_name: "Nombre",
  last_name: "Apellidos",
  nif: "NIF/DNI",
  birth_date: "Fecha de nacimiento",
  sex: "Sexo",
  phone: "Teléfono",
  email: "Email",
  address: "Dirección",
  city: "Ciudad",
  postal_code: "Código postal",
  notes: "Observaciones",
  source: "Canal captación",
  fiscal_name: "Nombre fiscal",
  fiscal_nif: "NIF fiscal",
  fiscal_address: "Dirección fiscal",
  fiscal_email: "Email fiscal",
  fiscal_phone: "Teléfono fiscal",
  company_name: "Empresa",
};

export function VoiceEditSection({ patientId, contactId, currentData }: Props) {
  const processVoiceEdit = useProcessVoiceEdit();
  const { data: voiceEdits } = useVoiceEdits({ patientId, contactId });

  const [step, setStep] = useState<Step>("idle");
  const [lastResult, setLastResult] = useState<{
    changes: Array<{ field: string; old_value?: string; new_value: string; reason: string }>;
    interpretation: string;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.start(250);
      setStep("recording");
      setLastResult(null);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;

    return new Promise<void>((resolve) => {
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        mr.stream.getTracks().forEach((t) => t.stop());

        setStep("uploading");
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((res, rej) => {
            reader.onload = () => res((reader.result as string).split(",")[1]);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });

          setStep("processing");
          const result = await processVoiceEdit.mutateAsync({
            patientId,
            contactId,
            audioBase64: base64,
            currentData,
          });

          setLastResult({ changes: result.changes, interpretation: result.interpretation });

          if (result.changes.length > 0) {
            setStep("done");
            toast.success(`${result.changes.length} campo(s) actualizado(s)`);
          } else {
            setStep("done");
            toast.info("No se identificaron cambios en la instrucción");
          }
          setTimeout(() => setStep("idle"), 4000);
        } catch (err: any) {
          setStep("error");
          toast.error(err.message || "Error al procesar");
          setTimeout(() => setStep("idle"), 3000);
        }
        resolve();
      };
      mr.stop();
    });
  }, [patientId, contactId, currentData, processVoiceEdit]);

  const isRecording = step === "recording";
  const isBusy = step !== "idle" && step !== "done" && step !== "error";

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold font-heading text-foreground">Editar ficha por voz</h3>
        {voiceEdits && voiceEdits.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setHistoryOpen(true)}>
            <History className="h-3.5 w-3.5" /> Historial ({voiceEdits.length})
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Dicta instrucciones como: "cambia el apellido por García López" o "la fecha de nacimiento es 15 de marzo de 1990"
      </p>

      <div className="flex items-center gap-3">
        {isRecording ? (
          <Button variant="destructive" size="sm" className="gap-2" onClick={stopRecording}>
            <Square className="h-4 w-4" /> Detener grabación
          </Button>
        ) : (
          <Button size="sm" className="gap-2" onClick={startRecording} disabled={isBusy}>
            <Mic className="h-4 w-4" /> Dictar cambios
          </Button>
        )}

        {step !== "idle" && (
          <div className="flex items-center gap-2 text-sm">
            {isBusy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {isRecording && <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />}
            {step === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {step === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
            <span className={step === "error" ? "text-destructive" : step === "done" ? "text-green-600" : "text-muted-foreground"}>
              {stepLabels[step]}
            </span>
          </div>
        )}
      </div>

      {/* Last result feedback */}
      {lastResult && lastResult.changes.length > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-2">Cambios aplicados:</p>
          <div className="space-y-1">
            {lastResult.changes.map((c, i) => (
              <div key={i} className="text-xs text-green-700 dark:text-green-400">
                <span className="font-medium">{fieldLabels[c.field] || c.field}:</span>{" "}
                {c.old_value && <span className="line-through text-muted-foreground mr-1">{c.old_value}</span>}
                → <span className="font-semibold">{c.new_value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Historial de ediciones por voz</DialogTitle>
            <DialogDescription>Registro de todos los cambios realizados por voz</DialogDescription>
          </DialogHeader>
          {!voiceEdits?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin ediciones registradas</p>
          ) : (
            <div className="space-y-2">
              {voiceEdits.map((e) => (
                <div key={e.id} className="border rounded-lg p-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedEdit(expandedEdit === e.id ? null : e.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                      </span>
                      <span className="text-xs font-medium text-primary">
                        {(e.fields_changed as any[])?.length || 0} campo(s)
                      </span>
                    </div>
                    {expandedEdit === e.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                  {expandedEdit === e.id && (
                    <div className="mt-2 space-y-2">
                      {e.transcription && (
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-[10px] font-semibold text-muted-foreground mb-1">Instrucción:</p>
                          <p className="text-xs">{e.transcription}</p>
                        </div>
                      )}
                      {e.interpreted_instruction && (
                        <p className="text-xs text-muted-foreground italic">{e.interpreted_instruction}</p>
                      )}
                      {(e.fields_changed as any[])?.map((c: any, i: number) => (
                        <div key={i} className="text-xs">
                          <span className="font-medium">{fieldLabels[c.field] || c.field}:</span>{" "}
                          {c.old_value && <span className="line-through text-muted-foreground mr-1">{c.old_value}</span>}
                          → <span className="font-semibold">{c.new_value}</span>
                          {c.reason && <span className="text-muted-foreground ml-1">({c.reason})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
