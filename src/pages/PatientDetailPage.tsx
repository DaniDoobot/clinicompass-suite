import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, FileText, MessageSquare, Edit, Plus, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { usePatient, usePatientAppointments, usePatientDocuments, usePatientInteractions, usePatientPacks } from "@/hooks/usePatients";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const aptStatus: Record<string, { label: string; variant: "success" | "info" | "warning" | "destructive" | "muted" }> = {
  confirmada: { label: "Confirmada", variant: "success" },
  realizada: { label: "Realizada", variant: "info" },
  pendiente: { label: "Pendiente", variant: "warning" },
  no_presentado: { label: "No presentado", variant: "destructive" },
  cancelada: { label: "Cancelada", variant: "muted" },
  reprogramada: { label: "Reprogramada", variant: "warning" },
};

const docStatus: Record<string, { label: string; variant: "success" | "info" | "warning" | "muted" }> = {
  validado: { label: "Validado", variant: "success" },
  subido: { label: "Subido", variant: "info" },
  pendiente: { label: "Pendiente", variant: "warning" },
  no_subido: { label: "No subido", variant: "muted" },
};

const interactionIcons: Record<string, string> = {
  llamada: "📞", email: "📧", whatsapp: "💬", nota: "📝", accion_comercial: "🎯",
};

export default function PatientDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: patient, isLoading } = usePatient(id);
  const { data: appointments } = usePatientAppointments(id);
  const { data: documents } = usePatientDocuments(id);
  const { data: interactions } = usePatientInteractions(id);
  const { data: packs } = usePatientPacks(id);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <div className="text-center p-12 text-muted-foreground">Paciente no encontrado</div>
      </AppLayout>
    );
  }

  const initials = `${patient.first_name?.[0] || ""}${patient.last_name?.[0] || ""}`.toUpperCase();
  const profName = (patient as any).professional ? `${(patient as any).professional.first_name} ${(patient as any).professional.last_name}` : "-";
  const activePack = packs?.find((p: any) => p.status === "activo");

  return (
    <AppLayout>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/pacientes")} className="gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a pacientes
        </Button>
      </div>

      <div className="stat-card mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary font-heading">{initials}</div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold font-heading text-foreground">{patient.first_name} {patient.last_name}</h1>
                <StatusBadge variant={patient.status === "activo" ? "success" : patient.status === "alta_pendiente" ? "warning" : "muted"}>
                  {patient.status}
                </StatusBadge>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {patient.phone}</span>}
                {patient.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {patient.email}</span>}
                {(patient as any).center?.name && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {(patient as any).center.name}</span>}
              </div>
              {patient.tags && patient.tags.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {patient.tags.map((t) => (
                    <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1"><Edit className="h-3.5 w-3.5" /> Editar</Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="appointments">Citas ({appointments?.length || 0})</TabsTrigger>
          <TabsTrigger value="interactions">Interacciones ({interactions?.length || 0})</TabsTrigger>
          <TabsTrigger value="documents">Documentos ({documents?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="stat-card lg:col-span-2">
              <h3 className="text-sm font-semibold font-heading text-foreground mb-4">Datos personales</h3>
              <div className="grid grid-cols-2 gap-4">
                {([
                  ["NIF/DNI", patient.nif],
                  ["Fecha nacimiento", patient.birth_date ? format(new Date(patient.birth_date), "dd/MM/yyyy") : "-"],
                  ["Sexo", patient.sex || "-"],
                  ["Teléfono", patient.phone || "-"],
                  ["Email", patient.email || "-"],
                  ["Dirección", [patient.address, patient.city, patient.postal_code].filter(Boolean).join(", ") || "-"],
                  ["Centro", (patient as any).center?.name || "-"],
                  ["Profesional", profName],
                  ["Canal captación", patient.source || "-"],
                ] as [string, string | null][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{value || "-"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {activePack && (
                <div className="stat-card">
                  <h3 className="text-sm font-semibold font-heading text-foreground mb-3">Bono activo</h3>
                  <p className="text-xs text-muted-foreground mb-2">{activePack.name}</p>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(activePack.used_sessions / activePack.total_sessions) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{activePack.used_sessions}/{activePack.total_sessions}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activePack.total_sessions - activePack.used_sessions} sesiones restantes
                    {activePack.expiry_date && ` · Vence ${format(new Date(activePack.expiry_date), "dd/MM/yyyy")}`}
                  </p>
                </div>
              )}

              {patient.notes && (
                <div className="stat-card">
                  <h3 className="text-sm font-semibold font-heading text-foreground mb-3">Observaciones</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{patient.notes}</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold font-heading text-foreground">Historial de citas</h3>
            </div>
            {appointments?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin citas registradas</p>
            ) : (
              <div className="space-y-2">
                {appointments?.map((a: any) => {
                  const st = aptStatus[a.status] || aptStatus.pendiente;
                  return (
                    <div key={a.id} className="flex items-center gap-4 p-3 rounded-lg table-row-hover">
                      <div className="flex items-center gap-2 w-32">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{format(new Date(a.start_time), "dd/MM/yyyy")}</span>
                      </div>
                      <span className="text-sm font-mono text-primary w-14">{format(new Date(a.start_time), "HH:mm")}</span>
                      <span className="text-sm flex-1">{a.service?.name || "-"}</span>
                      <span className="text-sm text-muted-foreground">{a.professional ? `${a.professional.first_name} ${a.professional.last_name}` : "-"}</span>
                      <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="interactions">
          <div className="stat-card">
            <h3 className="text-sm font-semibold font-heading text-foreground mb-4">Historial de interacciones</h3>
            {interactions?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin interacciones registradas</p>
            ) : (
              <div className="space-y-3">
                {interactions?.map((int: any) => (
                  <div key={int.id} className="flex gap-3 p-3 rounded-lg table-row-hover">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-sm">{interactionIcons[int.type] || "📌"}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground capitalize">{int.type}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{format(new Date(int.created_at), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                      {int.notes && <p className="text-xs text-muted-foreground mt-1">{int.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="stat-card">
            <h3 className="text-sm font-semibold font-heading text-foreground mb-4">Documentos</h3>
            {documents?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin documentos</p>
            ) : (
              <div className="space-y-2">
                {documents?.map((d: any) => {
                  const st = docStatus[d.status] || docStatus.pendiente;
                  return (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg table-row-hover">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{d.document_type?.name || d.file_name || "Documento"}</p>
                        <p className="text-xs text-muted-foreground">{d.document_type?.category || "general"}</p>
                      </div>
                      <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
