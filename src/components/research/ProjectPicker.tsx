import { useState } from "react";
import { useResearchProjects } from "@/hooks/useResearchProjects";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, FolderGit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  value?: string | null;
  onChange: (projectId: string | null, projectTitle?: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProjectPicker({ value, onChange, placeholder, className }: Props) {
  const { locale } = useLanguage();
  const { data: projects = [], isLoading } = useResearchProjects();
  const [open, setOpen] = useState(false);

  const selected = projects.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full min-w-0 justify-between font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">
              {selected?.title || placeholder || (locale === "pt" ? "Selecionar projeto..." : "Select project...")}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={locale === "pt" ? "Buscar projeto..." : "Search project..."} />
          <CommandList>
            <CommandEmpty>{isLoading ? "..." : locale === "pt" ? "Nenhum projeto" : "No projects"}</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__none__"
                  onSelect={() => { onChange(null); setOpen(false); }}
                  className="text-muted-foreground"
                >
                  {locale === "pt" ? "Remover vínculo" : "Remove link"}
                </CommandItem>
              )}
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.title}
                  onSelect={() => { onChange(p.id, p.title); setOpen(false); }}
                  className="min-w-0"
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 truncate">{p.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
