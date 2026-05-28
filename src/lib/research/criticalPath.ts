// Critical Path Method (CPM) over schedule items
// Items shape: { id, start_date, end_date, predecessor_id, dependency_type }

export type CPMNode = {
  id: string;
  durationDays: number;
  es: number; ef: number; ls: number; lf: number;
  slack: number;
  critical: boolean;
};

const dayMs = 86400000;

export function computeCriticalPath(items: any[]): Map<string, CPMNode> {
  const nodes = new Map<string, CPMNode>();
  const dated = items.filter((i) => i.start_date && i.end_date);
  if (!dated.length) return nodes;

  const minStart = Math.min(...dated.map((i) => new Date(i.start_date).getTime()));

  // Initialize with raw durations
  for (const it of dated) {
    const s = (new Date(it.start_date).getTime() - minStart) / dayMs;
    const e = (new Date(it.end_date).getTime() - minStart) / dayMs;
    nodes.set(it.id, {
      id: it.id,
      durationDays: Math.max(1, e - s),
      es: s, ef: e, ls: 0, lf: 0, slack: 0, critical: false,
    });
  }

  // Forward pass — earliest start based on predecessor FS
  // Topological order (simple iterative until stable)
  let changed = true;
  let safety = 50;
  while (changed && safety-- > 0) {
    changed = false;
    for (const it of dated) {
      if (!it.predecessor_id) continue;
      const pred = nodes.get(it.predecessor_id);
      const cur = nodes.get(it.id);
      if (!pred || !cur) continue;
      const type = it.dependency_type ?? "FS";
      let earliest = cur.es;
      if (type === "FS") earliest = Math.max(cur.es, pred.ef);
      else if (type === "SS") earliest = Math.max(cur.es, pred.es);
      else if (type === "FF") earliest = Math.max(cur.es, pred.ef - cur.durationDays);
      else if (type === "SF") earliest = Math.max(cur.es, pred.es - cur.durationDays);
      if (earliest !== cur.es) {
        cur.es = earliest;
        cur.ef = earliest + cur.durationDays;
        changed = true;
      }
    }
  }

  const projectEnd = Math.max(...Array.from(nodes.values()).map((n) => n.ef));
  for (const n of nodes.values()) { n.lf = projectEnd; n.ls = projectEnd - n.durationDays; }

  // Build successor map
  const successors = new Map<string, { id: string; type: string }[]>();
  for (const it of dated) {
    if (it.predecessor_id) {
      const list = successors.get(it.predecessor_id) ?? [];
      list.push({ id: it.id, type: it.dependency_type ?? "FS" });
      successors.set(it.predecessor_id, list);
    }
  }

  // Backward pass
  changed = true; safety = 50;
  while (changed && safety-- > 0) {
    changed = false;
    for (const n of nodes.values()) {
      const succs = successors.get(n.id) ?? [];
      if (!succs.length) continue;
      let latest = n.lf;
      for (const s of succs) {
        const sn = nodes.get(s.id);
        if (!sn) continue;
        if (s.type === "FS") latest = Math.min(latest, sn.ls);
        else if (s.type === "SS") latest = Math.min(latest, sn.ls + n.durationDays);
        else if (s.type === "FF") latest = Math.min(latest, sn.lf);
        else if (s.type === "SF") latest = Math.min(latest, sn.lf + n.durationDays);
      }
      if (latest !== n.lf) {
        n.lf = latest;
        n.ls = latest - n.durationDays;
        changed = true;
      }
    }
  }

  for (const n of nodes.values()) {
    n.slack = Math.round((n.ls - n.es) * 100) / 100;
    n.critical = n.slack <= 0.01;
  }
  return nodes;
}
