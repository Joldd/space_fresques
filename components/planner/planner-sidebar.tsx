"use client";

type PlannerSideBarProps = {
  onAddTable: () => void;
  onAddChair: () => void;
};

export function PlannerSideBar({ onAddTable, onAddChair }: PlannerSideBarProps) {
  return (
    <aside style={{ width: 200, padding: 16, borderRight: "1px solid #ccc" }}>
      <button onClick={onAddTable}>+ Table</button>
      <button onClick={onAddChair}>+ Chaise</button>
    </aside>
  );
}