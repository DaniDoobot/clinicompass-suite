import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Users, CalendarDays, MapPin, Phone, Edit, Plus, Loader2 } from "lucide-react";
import { useCenters, useCreateCenter } from "@/hooks/useCenters";
import { toast } from "sonner";

export default function CentersPage() {
  const { data: centers, isLoading } = useCenters();
  const createCenter = useCreateCenter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", postal_code: "", phone: "", email: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCenter.mutateAsync(form);
      toast.success("Centro creado");
      setDialogOpen(false);
      setForm({ name: "", address: "", city: "", postal_code: "", phone: "", email: "" });
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Centros" description="Gestión de centros y ubicaciones">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo centro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Nuevo centro</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Nombre *</Label>
                  <Input required className="h-9" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Dirección</Label>
                  <Input className="h-9" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ciudad</Label>
                  <Input className="h-9" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Código postal</Label>
                  <Input className="h-9" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Teléfono</Label>
                  <Input className="h-9" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" className="h-9" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={createCenter.isPending}>
                  {createCenter.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Crear centro
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Centros activos" value={centers?.length || 0} icon={Building2} iconColor="text-primary" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : centers?.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm">No hay centros registrados</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Centro</TableHead>
                <TableHead className="font-semibold">Dirección</TableHead>
                <TableHead className="font-semibold">Contacto</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centers?.map((c) => (
                <TableRow key={c.id} className="table-row-hover">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-primary" /></div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.email || "-"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate max-w-[200px]">{[c.address, c.city, c.postal_code].filter(Boolean).join(", ") || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.phone && <div className="flex items-center gap-1 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{c.phone}</div>}
                  </TableCell>
                  <TableCell><StatusBadge variant={c.active ? "success" : "muted"}>{c.active ? "Activo" : "Inactivo"}</StatusBadge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AppLayout>
  );
}
