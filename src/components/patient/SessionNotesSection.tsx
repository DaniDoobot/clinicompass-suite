import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Loader2, Plus, FileText, Volume2, Play, Pause, BookOpen } from "lucide-react";
import { useSynopsis, useSessionNotes, useProcessSessionNote } from "@/hooks/useVoiceEdit";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  patientId?: string;
  contactId?: string;
}

type Step = "idle" | "recording" | "uploading" | "processing" | "done" | "error";

export function SessionNotesSection({ patientId, contactId }: Props) {
  const { data: synopsis, isLoading: synLoading } = useSynopsis({ patientId, contactId });
  const { data: sessions, isLoading: sessLoading } = useSessionNotes({ patientId, contactId });
  const processSession = useProcessSessionNote();

  const [step, setStep] = useState<Step>("idle");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualContent, setManualContent] = useState("");
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

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
          await processSession.mutateAsync({
            patientId,
            contactId,
            audioBase64: base64,
            source: "voz",
          });

          setStep("done");
          toast.success("Sesión registrada y sinopsis actualizada");
          setTimeout(() => setStep("idle"), 2000);
        } catch (err: any) {
          setStep("error");
          toast.error(err.message || "Error al procesar");
          setTimeout(() => setStep("idle"), 3000);
        }
        resolve();
      };
      mr.stop();
    });
  }, [patientId, contactId, processSession]);

  const handleManualSubmit = async () => {
    if (!manualContent.trim()) { toast.error("Escribe el contenido de la sesión"); return; }
    setStep("processing");
    try {
      await processSession.mutateAsync({
        patientId,
        contactId,
        content: manualContent.trim(),
        source: "manual",
      });
      setManualContent("");
      setManualOpen(false);
      setStep("done");
      toast.success("Sesión registrada y sinopsis actualizada");
      setTimeout(() => setStep("idle"), 2000);
    } catch (err: any) {
      setStep("error");
      toast.error(err.message || "Error al guardar");
      setTimeout(() => setStep("idle"), 3000);
    }
  };

  const playAudio = async (filePath: string, noteId: string) => {
    if (playingAudio === noteId) {
      audioPlayerRef.current?.pause();
      setPlayingAudio(null);
      return;
    }
    try {
      const { data } = await supabase.storage.from("patient-audios").createSignedUrl(filePath, 300);
      if (!data?.signedUrl) { toast.error("No se pudo obtener el audio"); return; }
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      const audio = new Audio(data.signedUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setPlayingAudio(noteId);
    } catch { toast.error("Error al reproducir audio"); }
  };

  const isRecording = step === "recording";
  const isBusy = step !== "idle" && step !== "done" && step !== "error";

  return (
    <div className="space-y-4">
      {/* Synopsis */}
      <div className="stat-card">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold font-heading text-foreground">Sinopsis</h3>
        </div>
        <div className="min-h-[60px] p-3 rounded-lg bg-muted/50 border border-border/50">
          {synLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : synopsis?.content ? (
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{synopsis.content}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sin sinopsis. Se generará automáticamente al añadir la primera sesión.</p>
          )}
        </div>
        {synopsis?.updated_at && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Actualizada: {format(new Date(synopsis.updated_at), "dd/MM/yyyy HH:mm", { locale: es })}
          </p>
        )}
      </div>

      {/* Session history */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold font-heading text-foreground">Sesión a sesión</h3>
          <span className="text-xs text-muted-foreground">{sessions?.length || 0} sesiones</span>
        </div>

        {/* Add session buttons */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs"
            onClick={() => setManualOpen(!manualOpen)}
            disabled={isBusy}
          >
            <Plus className="h-3.5 w-3.5" /> Sesión manual
          </Button>

          {isRecording ? (
            <Button variant="destructive" size="sm" className="gap-2 text-xs" onClick={stopRecording}>
              <Square className="h-3.5 w-3.5" /> Detener
            </Button>
          ) : (
            <Button size="sm" className="gap-2 text-xs" onClick={startRecording} disabled={isBusy}>
              <Mic className="h-3.5 w-3.5" /> Sesión por voz
            </Button>
          )}

          {step !== "idle" && (
            <div className="flex items-center gap-2 text-xs">
              {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              {isRecording && <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />}
              <span className={step === "error" ? "text-destructive" : step === "done" ? "text-green-600" : "text-muted-foreground"}>
                {step === "recording" ? "Grabando..." : step === "uploading" ? "Subiendo..." : step === "processing" ? "Procesando..." : step === "done" ? "¡Listo!" : step === "error" ? "Error" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Manual input */}
        {manualOpen && (
          <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30 space-y-2">
            <Textarea
              className="text-xs min-h-[100px]"
              placeholder="Describe la sesión: motivo, observaciones, tratamiento aplicado, evolución..."
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setManualOpen(false); setManualContent(""); }}>
                Cancelar
              </Button>
              <Button size="sm" className="text-xs" onClick={handleManualSubmit} disabled={isBusy || !manualContent.trim()}>
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
                Guardar sesión
              </Button>
            </div>
          </div>
        )}

        {/* Sessions list */}
        {sessLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !sessions?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin sesiones registradas</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      s.source === "voz" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {s.source === "voz" ? "🎙 Voz" : "✏️ Manual"}
                    </span>
                  </div>
                  {s.audio_file_path && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs h-7"
                      onClick={() => playAudio(s.audio_file_path!, s.id)}
                    >
                      {playingAudio === s.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {playingAudio === s.id ? "Pausar" : "Audio"}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{s.content}</p>
                {s.transcription && s.source === "voz" && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                      Ver transcripción original
                    </summary>
                    <p className="text-xs text-muted-foreground mt-1 p-2 bg-muted/50 rounded">{s.transcription}</p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
