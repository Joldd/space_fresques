"use client";
import dynamic from "next/dynamic";

export default function DashboardPage() {
  const PlannerCanvas = dynamic(
    () =>
      import("@/components/planner/planner-canvas").then(
        (mod) => mod.PlannerCanvas,
      ),
    { ssr: false, loading: () => <p>Chargement du plan…</p> },
  );

  return <PlannerCanvas />;
}
