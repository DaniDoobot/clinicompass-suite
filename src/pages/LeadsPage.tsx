import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Phone, Mail, MessageSquare, Loader2, Users } from "lucide-react";
import { useLeads, useCreateLead } from "@/hooks/useLeads";
import { useCenters } from "@/hooks/useCenters";
import { useCenterFilter } from "@/components/layout/CenterSelector";
import { toast } from "sonner";
import { format } from "date-fns";

const stageConfig: Record<string, { variant: "info" | "primary" | "warning" | "success" | "muted" }> = {
  nuevo: { variant: "info" },
  contactado: { variant: "primary" },
  cualificado: { variant: "warning" },
  propuesta: { variant: "primary" },
  ganado: { variant: "success" },
  perdido: { variant: "muted" },
};

const lineConfig: Record<string, string> = {
  fisioterapia: "bg-primary/10 text-primary",
  nutricion: "bg-accent/10 text-accent",
  psicotecnicos: "bg-warning/10 text-warning",
};

const lineLabels: Record<string, string> = {
  fisioterapia: "Fisioterapia",
  nutricion: "Nutrición",
  psicotecnicos: "Psicotécnicos",
};

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { selectedCenterId } = useCenterFilter();

  const { data: leads, isLoading } = useLeads({
    business_line: lineFilter,
    status: statusFilter,
    search: search.length >= 2 ? search : undefined,
    center_id: selectedCenterId,
  });
  const { data: centers } = useCenters();
  const createLead = useCreateLead();

  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", company_name: "",
    business_line: "" as string, source: "", center_id: "", notes: "", estimated_value: "",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLead.mutateAsync({
        ...form,
        business_line: form.business_line as any,
        center_id: form.center_id || null,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      });
      toast.success("Lead creado correctamente");
      setDialogOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", company_name: "", business_line: "", source: "", center_id: "", notes: "", estimated_value: "" });
    } catch (err: any) {
      toast.error(err.message || "Error al crear lead");
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Leads" description={`${leads?.length || 0} leads en el sistema`}>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo lead</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">Nuevo lead</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre *</Label>
                  <Input required className="h-9" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Apellido</Label>
                  <Input className="h-9" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" className="h-9" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Teléfono</Label>
                  <Input className="h-9" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Empresa</Label>
                  <Input className="h-9" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Línea de negocio *</Label>
                  <Select value={form.business_line} onValueChange={(v) => setForm({ ...form, business_line: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                      <SelectItem value="nutricion">Nutrición</SelectItem>
                      <SelectItem value="psicotecnicos">Psicotécnicos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Origen</Label>
                  <Input className="h-9" placeholder="Web, teléfono, referido..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor estimado (€)</Label>
                  <Input type="number" step="0.01" className="h-9" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Centro</Label>
                  <Select value={form.center_id} onValueChange={(v) => setForm({ ...form, center_id: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar centro" /></SelectTrigger>
                    <SelectContent>
                      {centers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={createLead.isPending}>
                  {createLead.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Crear lead
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar lead..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={lineFilter} onValueChange={setLineFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Servicio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las líneas</SelectItem>
            <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
            <SelectItem value="nutricion">Nutrición</SelectItem>
            <SelectItem value="psicotecnicos">Psicotécnicos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="nuevo">Nuevo</SelectItem>
            <SelectItem value="contactado">Contactado</SelectItem>
            <SelectItem value="cualificado">Cualificado</SelectItem>
            <SelectItem value="propuesta">Propuesta</SelectItem>
            <SelectItem value="ganado">Ganado</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : leads?.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">No hay leads</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Lead</TableHead>
                <TableHead className="font-semibold">Línea</TableHead>
                <TableHead className="font-semibold">Origen</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="font-semibold">Centro</TableHead>
                <TableHead className="font-semibold">Valor</TableHead>
                <TableHead className="font-semibold">Fecha</TableHead>
                <TableHead className="w-[100px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads?.map((l: any) => {
                const initials = `${l.first_name?.[0] || ""}${(l.last_name || l.company_name || "")?.[0] || ""}`.toUpperCase();
                return (
                  <TableRow key={l.id} className="table-row-hover">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{initials}</div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{l.first_name} {l.last_name}</p>
                          <p className="text-xs text-muted-foreground">{l.email || l.company_name || "-"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lineConfig[l.business_line] || ""}`}>
                        {lineLabels[l.business_line] || l.business_line}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.source || "-"}</TableCell>
                    <TableCell><StatusBadge variant={stageConfig[l.status]?.variant || "muted"}>{l.status}</StatusBadge></TableCell>
                    <TableCell className="text-sm">{l.center?.name || "-"}</TableCell>
                    <TableCell className="text-sm font-semibold">{l.estimated_value ? `€${l.estimated_value}` : "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(l.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <button className="p-1.5 rounded-md hover:bg-muted transition-colors"><Phone className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button className="p-1.5 rounded-md hover:bg-muted transition-colors"><Mail className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button className="p-1.5 rounded-md hover:bg-muted transition-colors"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </AppLayout>
  );
}
