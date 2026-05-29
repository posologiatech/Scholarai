import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RichText } from "./RichText";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { ChevronLeft, ChevronRight, X, Calendar } from "lucide-react";

interface Props {
  meeting: any;
  open: boolean;
  onClose: () => void;
}

export const MeetingPresentation = ({ meeting, open, onClose }: Props) => {
  const { locale } = useLanguage();
  const [idx, setIdx] = useState(0);

  const { data: agendaItems = [] } = useQuery({
    queryKey: ["agenda-items", meeting.id],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("research_meeting_agenda_items")
        .select("*").eq("meeting_id", meeting.id).order("position");
      return data ?? [];
    },
  });

  // Build slide list: title + general notes + one per agenda item
  const slides: { title: string; body?: string | null; kind: string }[] = [
    { title: meeting.title, body: null, kind: "cover" },
    ...(meeting.notes?.trim() ? [{ title: locale === "pt" ? "Notas gerais" : "General notes", body: meeting.notes, kind: "notes" }] : []),
    ...agendaItems.map((a: any) => ({ title: a.title, body: a.notes, kind: "agenda" })),
  ];

  useEffect(() => { if (open) setIdx(0); }, [open, meeting.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setIdx((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, slides.length, onClose]);

  if (!open) return null;
  const slide = slides[Math.min(idx, slides.length - 1)];

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />{new Date(meeting.scheduled_at).toLocaleDateString()}
        </div>
        <div className="text-xs text-muted-foreground">{idx + 1} / {slides.length}</div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-4xl">
          {slide.kind === "cover" ? (
            <div className="text-center space-y-6">
              <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                {locale === "pt" ? "Reunião" : "Meeting"}
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                {slide.title}
              </h1>
              <p className="text-muted-foreground text-lg">{new Date(meeting.scheduled_at).toLocaleString()}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight border-l-4 border-primary pl-4">{slide.title}</h2>
              <div className="text-lg md:text-xl leading-relaxed [&_.prose]:prose-lg">
                {slide.body?.trim()
                  ? <RichText content={slide.body} className="prose-lg" />
                  : <p className="text-muted-foreground italic">{locale === "pt" ? "Sem anotações." : "No notes."}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t">
        <Button variant="outline" onClick={() => setIdx((i) => Math.max(i - 1, 0))} disabled={idx === 0}>
          <ChevronLeft className="h-4 w-4" />{locale === "pt" ? "Anterior" : "Previous"}
        </Button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`} />
          ))}
        </div>
        <Button variant="outline" onClick={() => setIdx((i) => Math.min(i + 1, slides.length - 1))} disabled={idx === slides.length - 1}>
          {locale === "pt" ? "Próximo" : "Next"}<ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MeetingPresentation;
