"use client";
import dynamic from "next/dynamic";

export default function DashboardPage() {

  const PlannerCanvas = dynamic(() => import("@/components/planner-canvas"), {
    ssr: false,
    loading: () => <p>Chargement du plan…</p>,
  });

  return (
    <PlannerCanvas />
  );
}
