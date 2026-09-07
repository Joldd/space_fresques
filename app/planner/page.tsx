"use client";
import dynamic from "next/dynamic";

const PlannerCanvas = dynamic(
  () =>
    import("@/components/planner/planner-canvas").then(
      (mod) => mod.PlannerCanvas,
    ),
  { ssr: false, loading: () => <p className="p-6">Chargement du plan…</p> },
);

export default function PlannerPage() {
  return <PlannerCanvas />;
}
