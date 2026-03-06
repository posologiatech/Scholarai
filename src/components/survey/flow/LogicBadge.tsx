import { GitBranch } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/i18n/LanguageContext";

const LogicBadge = ({ count }: { count: number }) => {
  const { locale } = useLanguage();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 cursor-default">
          <GitBranch className="h-3 w-3" />
          {count}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {count} {locale === "pt" ? "regra(s) de lógica" : "logic rule(s)"}
      </TooltipContent>
    </Tooltip>
  );
};

export default LogicBadge;
