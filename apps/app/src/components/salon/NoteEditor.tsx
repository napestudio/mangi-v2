import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NoteEditorProps {
  value?: string;
  onChange: (note: string | undefined) => void;
}

export function NoteEditor({ value, onChange }: NoteEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (editing) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <textarea
          autoFocus
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ej: sin picante"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const trimmed = draft.trim();
              onChange(trimmed ? trimmed : undefined);
              setEditing(false);
            }}
          >
            Guardar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        aria-label="Agregar nota"
        className={cn("shrink-0 rounded-md border border-neutral-300 p-1.5 text-neutral-500 hover:bg-neutral-100")}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </button>
      {value && <p className="truncate text-xs italic text-neutral-500">{value}</p>}
    </div>
  );
}
