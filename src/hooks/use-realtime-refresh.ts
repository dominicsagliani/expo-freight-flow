import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Refetch the given queries whenever rows in these tables change (RLS-scoped). */
export function useRealtimeRefresh(tables: string[], queryKeys: string[][]) {
  const qc = useQueryClient();
  const tk = tables.join(","), qk = JSON.stringify(queryKeys);
  useEffect(() => {
    const ch = supabase.channel(`rt-${tk}-${Math.random().toString(36).slice(2)}`);
    for (const table of tk.split(",")) {
      ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const key of JSON.parse(qk) as string[][]) qc.invalidateQueries({ queryKey: key });
      });
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tk, qk, qc]);
}
