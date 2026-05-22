import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, ImageIcon, Loader2, Download, Sparkles, X, MapPin, Wand2 } from "lucide-react";
import { SpreadsheetData } from "@/pages/DataMind";
import { generateHeatmap, mapLatLonToPixels, HeatmapPoint, HeatmapStyle } from "@/lib/heatmap/generateHeatmap";
import { COLORMAPS, ColormapName } from "@/lib/heatmap/colormaps";
import { supabase } from "@/integrations/supabase/client";

type Mode = "ai_fill" | "xy_px" | "xy_norm" | "latlon" | "regions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: SpreadsheetData | null;
  fileName?: string;
  onResult?: (pngDataUrl: string) => void;
}

interface RegionPin {
  label: string;
  x: number; // px in natural image
  y: number;
}

export default function HeatmapOverlayDialog({ open, onOpenChange, data, fileName, onResult }: Props) {
  const [step, setStep] = useState(0);

  // Image
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState("");

  // Data mapping
  const [valueCol, setValueCol] = useState<string>("");
  const [mode, setMode] = useState<Mode>("ai_fill");
  const [aiLabelCol, setAiLabelCol] = useState<string>("");
  const [xCol, setXCol] = useState<string>("");
  const [yCol, setYCol] = useState<string>("");
  const [latCol, setLatCol] = useState<string>("");
  const [lonCol, setLonCol] = useState<string>("");
  const [bbox, setBbox] = useState({ north: 0, south: 0, east: 0, west: 0 });
  const [regionCol, setRegionCol] = useState<string>("");
  const [pins, setPins] = useState<RegionPin[]>([]);
  const [pickingFor, setPickingFor] = useState<string | null>(null);

  // Style
  const [style, setStyle] = useState<HeatmapStyle>({
    colormap: "redgreen",
    opacity: 0.65,
    radius: 60,
    bins: 0,
    showLegend: true,
    title: "",
    unit: "",
    footer: "",
  });

  // Output
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string>("");
  const [refining, setRefining] = useState(false);

  const previewRef = useRef<HTMLImageElement | null>(null);

  // Derived
  const columns = data?.columns ?? [];
  const numericCols = useMemo(() => {
    if (!data) return [];
    return data.columns.filter((c) =>
      data.rows.slice(0, 50).some((r) => {
        const v = r[c];
        return v !== "" && v != null && !isNaN(Number(v));
      })
    );
  }, [data]);
  const uniqueLabels = useMemo(() => {
    if (!data || !regionCol) return [];
    const s = new Set<string>();
    for (const r of data.rows) {
      const v = String(r[regionCol] ?? "").trim();
      if (v) s.add(v);
    }
    return Array.from(s);
  }, [data, regionCol]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(0);
      setResultUrl("");
    }
  }, [open]);

  const handleImageFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setImageName(file.name);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => setImageEl(img);
    img.onerror = () => toast.error("Não foi possível carregar a imagem");
    img.src = url;
  };

  const buildPoints = (): { points: HeatmapPoint[]; warnings: string[] } => {
    const points: HeatmapPoint[] = [];
    const warnings: string[] = [];
    if (!data || !imageEl || !valueCol) return { points, warnings };
    const W = imageEl.naturalWidth;
    const H = imageEl.naturalHeight;

    for (const row of data.rows) {
      const value = Number(row[valueCol]);
      if (!isFinite(value)) continue;

      if (mode === "xy_px") {
        const x = Number(row[xCol]);
        const y = Number(row[yCol]);
        if (!isFinite(x) || !isFinite(y)) continue;
        points.push({ x, y, value });
      } else if (mode === "xy_norm") {
        const x = Number(row[xCol]);
        const y = Number(row[yCol]);
        if (!isFinite(x) || !isFinite(y)) continue;
        points.push({ x: x * W, y: y * H, value });
      } else if (mode === "latlon") {
        const lat = Number(row[latCol]);
        const lon = Number(row[lonCol]);
        if (!isFinite(lat) || !isFinite(lon)) continue;
        const p = mapLatLonToPixels(lat, lon, bbox, W, H);
        if (!p) continue;
        points.push({ ...p, value });
      } else if (mode === "regions") {
        const label = String(row[regionCol] ?? "").trim();
        const pin = pins.find((pn) => pn.label === label);
        if (!pin) continue;
        points.push({ x: pin.x, y: pin.y, value });
      }
    }
    if (points.length === 0) warnings.push("Nenhum ponto válido foi gerado com a configuração atual.");
    return { points, warnings };
  };

  const imageToDataUrl = async (): Promise<string> => {
    if (!imageEl) throw new Error("Imagem ausente");
    const c = document.createElement("canvas");
    c.width = imageEl.naturalWidth;
    c.height = imageEl.naturalHeight;
    c.getContext("2d")!.drawImage(imageEl, 0, 0);
    return c.toDataURL("image/png");
  };

  const handleGenerate = async () => {
    if (!imageEl) return toast.error("Carregue uma imagem base");
    if (!valueCol) return toast.error("Escolha a coluna de valor");

    setGenerating(true);
    try {
      if (mode === "ai_fill") {
        if (!aiLabelCol) {
          toast.error("Escolha a coluna de rótulo (região/categoria).");
          setGenerating(false);
          return;
        }
        // Build label→value pairs (aggregate by mean if duplicate labels)
        const agg = new Map<string, { sum: number; n: number }>();
        for (const r of data!.rows) {
          const label = String(r[aiLabelCol] ?? "").trim();
          const v = Number(r[valueCol]);
          if (!label || !isFinite(v)) continue;
          const prev = agg.get(label) || { sum: 0, n: 0 };
          prev.sum += v; prev.n += 1;
          agg.set(label, prev);
        }
        const dataPairs = Array.from(agg.entries()).map(([label, a]) => ({
          label,
          value: +(a.sum / a.n).toFixed(4),
        }));
        if (dataPairs.length === 0) {
          toast.error("Nenhum par rótulo/valor válido encontrado.");
          setGenerating(false);
          return;
        }
        const baseImage = await imageToDataUrl();
        toast.info("Gerando mapa de calor com IA (cobertura total)...");
        const { data: out, error } = await supabase.functions.invoke("refine-heatmap-ai", {
          body: {
            mode: "full_fill",
            baseImage,
            dataPairs,
            colormap: style.colormap,
            title: style.title,
            unit: style.unit,
            valueLabel: valueCol,
            regionLabel: aiLabelCol,
          },
        });
        if (error || out?.error) throw new Error(out?.error || error?.message || "Falha IA");
        if (!out?.image_url) throw new Error("IA não retornou imagem");
        setResultUrl(out.image_url);
        setStep(3);
        return;
      }

      const { points, warnings } = buildPoints();
      if (warnings.length) {
        toast.error(warnings.join(" "));
        return;
      }
      const finalStyle: HeatmapStyle = {
        ...style,
        footer:
          style.footer ||
          `Gerado pelo DataMind · base: ${imageName || "imagem"} · dados: ${valueCol} (n=${points.length})`,
      };
      const blob = await generateHeatmap({ baseImage: imageEl, points, style: finalStyle });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setStep(3);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao gerar o mapa de calor");
    } finally {
      setGenerating(false);
    }
  };

  const handleRefineAI = async () => {
    if (!resultUrl) return;
    setRefining(true);
    try {
      // Convert blob URL to base64
      const blob = await fetch(resultUrl).then((r) => r.blob());
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(blob);
      });
      const { data: out, error } = await supabase.functions.invoke("refine-heatmap-ai", {
        body: { image: dataUrl, title: style.title, unit: style.unit },
      });
      if (error || out?.error) throw new Error(out?.error || error?.message);
      if (out?.image_url) {
        setResultUrl(out.image_url);
        toast.success("Imagem refinada com IA");
      } else {
        toast.error("IA não retornou imagem");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha no refinamento");
    } finally {
      setRefining(false);
    }
  };

  const handleSendToChat = () => {
    if (!resultUrl) return;
    onResult?.(resultUrl);
    onOpenChange(false);
  };

  // Region picker handler
  const handlePreviewClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (mode !== "regions" || !pickingFor || !previewRef.current || !imageEl) return;
    const rect = previewRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * imageEl.naturalWidth;
    const py = ((e.clientY - rect.top) / rect.height) * imageEl.naturalHeight;
    setPins((prev) => {
      const others = prev.filter((p) => p.label !== pickingFor);
      return [...others, { label: pickingFor, x: px, y: py }];
    });
    setPickingFor(null);
  };

  const canProceed1 = !!imageEl;
  const canProceed2 =
    !!valueCol &&
    ((mode === "ai_fill" && aiLabelCol) ||
      (mode === "xy_px" && xCol && yCol) ||
      (mode === "xy_norm" && xCol && yCol) ||
      (mode === "latlon" && latCol && lonCol && (bbox.north !== bbox.south) && (bbox.east !== bbox.west)) ||
      (mode === "regions" && regionCol && pins.length > 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Mapa de Calor sobre Imagem
          </DialogTitle>
          <DialogDescription>
            Sobreponha valores numéricos de uma planilha em qualquer imagem (mapa, planta, foto, esquema).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="0">1. Imagem</TabsTrigger>
            <TabsTrigger value="1" disabled={!canProceed1}>2. Dados</TabsTrigger>
            <TabsTrigger value="2" disabled={!canProceed1 || !canProceed2}>3. Estilo</TabsTrigger>
            <TabsTrigger value="3" disabled={!resultUrl}>4. Resultado</TabsTrigger>
          </TabsList>

          {/* STEP 1: Image */}
          <TabsContent value="0" className="space-y-4 pt-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                id="hm-image-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageFile(f);
                  e.target.value = "";
                }}
              />
              <label htmlFor="hm-image-input" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-sm font-medium">Carregar imagem base</div>
                <div className="text-xs text-muted-foreground">PNG, JPG ou WEBP</div>
              </label>
            </div>
            {imageEl && (
              <div className="rounded-lg border border-border overflow-hidden bg-muted/30">
                <img src={imageUrl} alt={imageName} className="max-h-[300px] w-full object-contain" />
                <div className="p-2 text-xs text-muted-foreground flex items-center gap-2">
                  <ImageIcon className="h-3 w-3" />
                  {imageName} · {imageEl.naturalWidth}×{imageEl.naturalHeight}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!canProceed1}>Avançar</Button>
            </div>
          </TabsContent>

          {/* STEP 2: Data mapping */}
          <TabsContent value="1" className="space-y-4 pt-4">
            {!data ? (
              <div className="rounded-lg border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                Nenhuma planilha carregada. Volte ao chat e suba um arquivo CSV/XLSX primeiro.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Coluna de valor (numérica)</Label>
                    <Select value={valueCol} onValueChange={setValueCol}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {numericCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modo de posicionamento</Label>
                    <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ai_fill">✨ Cobertura total (IA recolore toda a forma)</SelectItem>
                        <SelectItem value="xy_px">X,Y em pixels (pontos)</SelectItem>
                        <SelectItem value="xy_norm">X,Y normalizado 0–1 (pontos)</SelectItem>
                        <SelectItem value="latlon">Latitude/Longitude + bbox (pontos)</SelectItem>
                        <SelectItem value="regions">Regiões nomeadas — clicar na imagem (pontos)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {mode === "ai_fill" && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                    <div className="text-xs text-muted-foreground">
                      A IA usará a imagem como referência de forma e recolorirá toda ela como um choropleth/mapa de calor, atribuindo uma cor a cada região conforme o valor.
                    </div>
                    <div>
                      <Label>Coluna de rótulo (nome da região/categoria)</Label>
                      <Select value={aiLabelCol} onValueChange={setAiLabelCol}>
                        <SelectTrigger><SelectValue placeholder="Ex: Município, Estado, Bairro..." /></SelectTrigger>
                        <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}


                {(mode === "xy_px" || mode === "xy_norm") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Coluna X</Label>
                      <Select value={xCol} onValueChange={setXCol}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Coluna Y</Label>
                      <Select value={yCol} onValueChange={setYCol}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {mode === "latlon" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Coluna Latitude</Label>
                        <Select value={latCol} onValueChange={setLatCol}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Coluna Longitude</Label>
                        <Select value={lonCol} onValueChange={setLonCol}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Caixa delimitadora (bounding box) da imagem</Label>
                      <div className="grid grid-cols-4 gap-2 mt-1">
                        {(["north", "south", "east", "west"] as const).map((k) => (
                          <Input
                            key={k}
                            type="number"
                            step="any"
                            placeholder={k}
                            value={bbox[k] || ""}
                            onChange={(e) => setBbox({ ...bbox, [k]: Number(e.target.value) })}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {mode === "regions" && (
                  <div className="space-y-3">
                    <div>
                      <Label>Coluna com rótulos das regiões</Label>
                      <Select value={regionCol} onValueChange={(v) => { setRegionCol(v); setPins([]); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {regionCol && (
                      <>
                        <div className="text-xs text-muted-foreground">
                          Clique em "Marcar" e clique sobre a imagem para posicionar cada região.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {uniqueLabels.map((lbl) => {
                            const pin = pins.find((p) => p.label === lbl);
                            const isPicking = pickingFor === lbl;
                            return (
                              <Button
                                key={lbl}
                                size="sm"
                                variant={pin ? "secondary" : isPicking ? "default" : "outline"}
                                onClick={() => setPickingFor(isPicking ? null : lbl)}
                                className="gap-1"
                              >
                                <MapPin className="h-3 w-3" />
                                {lbl} {pin && "✓"}
                              </Button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Preview with optional click-to-pin */}
                {imageUrl && (
                  <div className="relative rounded-lg border border-border overflow-hidden bg-muted/20">
                    <img
                      ref={previewRef}
                      src={imageUrl}
                      alt="preview"
                      className={"max-h-[320px] w-full object-contain " + (pickingFor ? "cursor-crosshair" : "")}
                      onClick={handlePreviewClick}
                    />
                    {pickingFor && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                        Clique para marcar: {pickingFor}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>Voltar</Button>
              <Button onClick={() => setStep(2)} disabled={!canProceed2}>Avançar</Button>
            </div>
          </TabsContent>

          {/* STEP 3: Style */}
          <TabsContent value="2" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Paleta de cores</Label>
                <Select value={style.colormap} onValueChange={(v) => setStyle({ ...style, colormap: v as ColormapName })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLORMAPS.map((c) => <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Faixas (0 = contínuo)</Label>
                <Input
                  type="number" min={0} max={20}
                  value={style.bins}
                  onChange={(e) => setStyle({ ...style, bins: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Opacidade: {(style.opacity * 100).toFixed(0)}%</Label>
                <Slider value={[style.opacity]} min={0.1} max={1} step={0.05} onValueChange={([v]) => setStyle({ ...style, opacity: v })} />
              </div>
              <div>
                <Label>Raio (px): {style.radius}</Label>
                <Slider value={[style.radius]} min={10} max={200} step={5} onValueChange={([v]) => setStyle({ ...style, radius: v })} />
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <Label>Título</Label>
                  <Input value={style.title} onChange={(e) => setStyle({ ...style, title: e.target.value })} placeholder="Ex: Temperatura da Superfície 2006" />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Input value={style.unit} onChange={(e) => setStyle({ ...style, unit: e.target.value })} placeholder="Ex: °C" />
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch checked={style.showLegend} onCheckedChange={(v) => setStyle({ ...style, showLegend: v })} />
                <Label>Mostrar legenda</Label>
              </div>
              <div className="col-span-2">
                <Label>Rodapé (créditos / fonte)</Label>
                <Textarea
                  rows={2}
                  value={style.footer}
                  onChange={(e) => setStyle({ ...style, footer: e.target.value })}
                  placeholder="Gerado automaticamente se vazio"
                />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Gerando...</> : <><Sparkles className="h-4 w-4 mr-1" />Gerar mapa de calor</>}
              </Button>
            </div>
          </TabsContent>

          {/* STEP 4: Result */}
          <TabsContent value="3" className="space-y-4 pt-4">
            {resultUrl ? (
              <>
                <div className="rounded-lg border border-border overflow-hidden bg-white">
                  <img src={resultUrl} alt="Heatmap" className="w-full object-contain max-h-[60vh]" />
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <X className="h-4 w-4 mr-1" /> Ajustar estilo
                  </Button>
                  <Button variant="outline" onClick={handleRefineAI} disabled={refining}>
                    {refining ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
                    Refinar com IA
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={resultUrl} download={`heatmap-${Date.now()}.png`}>
                      <Download className="h-4 w-4 mr-1" /> Baixar PNG
                    </a>
                  </Button>
                  <Button onClick={handleSendToChat}>Enviar ao chat</Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Gere o mapa primeiro.</div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
