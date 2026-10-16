// components/planner/planner-sidebar.tsx
"use client";

import { useState, useEffect, type FormEvent } from "react";
import type { RoomId } from "@/lib/planner/types";
import { DEFAULT_CHAIR, DEFAULT_TABLE } from "@/lib/planner/use-planner-store";
import { PLAN_ROOMS } from "@/lib/planner/rooms";
import type { PlanData } from "@/lib/planner/plan-file";
import { PlanLibrary } from "./plan-library";

type PlannerSideBarProps = {
  /** salle dans laquelle les nouvelles tables sont ajoutées */
  activeRoomId: RoomId;
  onActiveRoomChange: (roomId: RoomId) => void;
  onAddTable: (roomId: RoomId, widthCm: number, depthCm: number) => void;
  onAddChair: (roomId: RoomId, diameterCm: number) => void;
  /** les zones ne dépendent d'aucune salle : pas de choix de salle, l'appelant décide où la poser */
  onAddZone: () => void;
  selectedCount: number;
  hasSelectedTable: boolean;
  /** une table seule sélectionnée affiche son propre menu contextuel sur le canvas — la carte "Sélection" générique serait redondante */
  hasContextPanel: boolean;
  onRotate: () => void;
  onDelete: () => void;
  onExportJpeg: () => void;
  onExportPdf: () => void;
  currentPlan: PlanData;
  onOpenPlan: (plan: PlanData) => void;
  /**
   * En dessous du breakpoint "md", la sidebar devient un tiroir superposé
   * (voir SIDEBAR_BREAKPOINT_PX) : `open` contrôle sa visibilité et `onClose`
   * la referme (bouton dédié, ou tap sur le fond assombri derrière elle).
   * Sans effet à partir de "md", où elle reste toujours affichée en colonne.
   */
  open: boolean;
  onClose: () => void;
};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[#3F5A45] dark:text-[#B9D3BC] mb-3 tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 1,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  suffix: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-[#4A4636] dark:text-[#D8D2BE]">
      <span>{label}</span>
      <div className="flex items-center gap-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#20241f] px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[#7A9E7E]">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent outline-none"
        />
        <span className="text-xs text-[#8A8368] dark:text-[#8FA090]">
          {suffix}
        </span>
      </div>
    </label>
  );
}

/** choix de la salle de destination d'un ajout (une pastille par salle) */
function RoomPicker({
  value,
  onChange,
}: {
  value: RoomId;
  onChange: (roomId: RoomId) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm text-[#4A4636] dark:text-[#D8D2BE]">
      <span>Dans la salle</span>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1">
        {PLAN_ROOMS.map(({ room }) => (
          <button
            key={room.id}
            type="button"
            onClick={() => onChange(room.id)}
            aria-pressed={room.id === value}
            className={`rounded-lg px-2 py-1.5 text-xs font-medium leading-tight transition-colors ${
              room.id === value
                ? "bg-[#3F5A45] text-white shadow-sm"
                : "text-[#4A4636] dark:text-[#D8D2BE] hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {room.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlannerSideBar({
  activeRoomId,
  onActiveRoomChange,
  onAddTable,
  onAddChair,
  onAddZone,
  selectedCount,
  hasSelectedTable,
  hasContextPanel,
  onRotate,
  onDelete,
  onExportJpeg,
  onExportPdf,
  currentPlan,
  onOpenPlan,
  open,
  onClose,
}: PlannerSideBarProps) {
  const [tableWidth, setTableWidth] = useState(DEFAULT_TABLE.widthCm);
  const [tableDepth, setTableDepth] = useState(DEFAULT_TABLE.depthCm);
  const [chairDiameter, setChairDiameter] = useState(DEFAULT_CHAIR.diameterCm);

  function submitTable(e: FormEvent) {
    e.preventDefault();
    onAddTable(activeRoomId, Math.max(tableWidth, 10), Math.max(tableDepth, 10));
  }

  function submitChair(e: FormEvent) {
    e.preventDefault();
    onAddChair(activeRoomId, Math.max(chairDiameter, 10));
  }

  return (
    <>
      {/* fond assombri derrière le tiroir mobile ; absent (et sans effet) à partir de "md" */}
      {open && (
        <div
          aria-hidden
          onClick={onClose}
          className="fixed inset-0 top-14 z-30 bg-black/40 md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 top-14 left-0 z-40 w-85 max-w-[88vw] shrink-0 overflow-y-auto bg-[#F6F1E7]/95 dark:bg-[#171a16] border-r border-black/5 dark:border-white/10 p-4 flex flex-col gap-4 shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:static md:inset-y-auto md:top-auto md:z-auto md:h-full md:w-85 md:translate-x-0 md:shadow-none md:bg-[#F6F1E7]/80`}
      >
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-semibold text-[#3F5A45] dark:text-[#B9D3BC]">
            🌿 Plan de salle
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les réglages"
            className="md:hidden shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-[#4A4636] dark:text-[#D8D2BE] hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
          >
            ✕
          </button>
        </div>

        <Card title="Ajouter une table">
          <form onSubmit={submitTable} className="flex flex-col gap-3">
            <RoomPicker value={activeRoomId} onChange={onActiveRoomChange} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Largeur"
                value={tableWidth}
                onChange={setTableWidth}
                min={10}
                suffix="cm"
              />
              <NumberField
                label="Profondeur"
                value={tableDepth}
                onChange={setTableDepth}
                min={10}
                suffix="cm"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#D98E73] text-white text-sm font-medium py-2 hover:bg-[#c97c60] transition-colors"
            >
              + Ajouter une table
            </button>
          </form>
        </Card>

        <Card title="Ajouter une zone">
          <p className="text-sm text-[#4A4636] dark:text-[#D8D2BE] mb-3">
            Un rectangle coloré et libre pour délimiter une partie du plan.
            Clique dessus pour la nommer, la recolorer ou la redimensionner.
          </p>
          <button
            type="button"
            onClick={onAddZone}
            className="w-full rounded-xl bg-[#6E93C0] text-white text-sm font-medium py-2 hover:bg-[#5c81ae] transition-colors"
          >
            + Ajouter une zone
          </button>
        </Card>

        <Card title="Exporter le plan">
          <p className="text-sm text-[#4A4636] dark:text-[#D8D2BE] mb-3">
            Les salles, les tables et les zones, avec leur légende.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onExportJpeg}
              className="rounded-xl bg-black/5 dark:bg-white/10 text-[#4A4636] dark:text-[#D8D2BE] text-sm font-medium py-2 hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
            >
              🖼 JPEG
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              className="rounded-xl bg-black/5 dark:bg-white/10 text-[#4A4636] dark:text-[#D8D2BE] text-sm font-medium py-2 hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
            >
              📄 PDF
            </button>
          </div>
        </Card>

        <Card title="Mes plans">
          <PlanLibrary currentPlan={currentPlan} onOpenPlan={onOpenPlan} />
        </Card>

        {/* Pas besoin de chaises pour l'instant */}
        {/* <Card title="Ajouter une chaise">
        <form onSubmit={submitChair} className="flex flex-col gap-3">
          <NumberField label="Diamètre" value={chairDiameter} onChange={setChairDiameter} min={10} suffix="cm" />
          <button
            type="submit"
            className="rounded-xl bg-[#7A9E7E] text-white text-sm font-medium py-2 hover:bg-[#6b8f6f] transition-colors"
          >
            + Ajouter une chaise
          </button>
        </form>
      </Card> */}

        {selectedCount > 0 && !hasContextPanel && (
          <Card title="Sélection">
            <p className="text-sm text-[#4A4636] dark:text-[#D8D2BE] mb-3">
              {selectedCount} élément{selectedCount > 1 ? "s" : ""} sélectionné
              {selectedCount > 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              {hasSelectedTable && (
                <button
                  onClick={onRotate}
                  className="flex-1 rounded-xl bg-[#7A9E7E] text-white text-sm font-medium py-2 hover:bg-[#6b8f6f] transition-colors"
                >
                  ↻ Pivoter
                </button>
              )}
              <button
                onClick={onDelete}
                className="flex-1 rounded-xl bg-[#D9765F] text-white text-sm font-medium py-2 hover:bg-[#c76650] transition-colors"
              >
                🗑 Supprimer
              </button>
            </div>
          </Card>
        )}

        <div className="mt-auto text-xs text-[#8A8368] dark:text-[#8FA090] leading-relaxed">
          <p className="font-medium mb-1">Astuces</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>
              Clic + glisser sur une zone vide pour sélectionner plusieurs
              éléments
            </li>
            <li>Ctrl/Cmd + clic pour ajouter à la sélection</li>
            <li>Touche R pour pivoter, Suppr pour supprimer</li>
            <li>Ctrl/Cmd + C puis V pour copier-coller</li>
            <li>Ctrl/Cmd + Z pour annuler la dernière action</li>
            <li>
              Impossible de sortir une table de sa salle en la glissant :
              clique dessus puis « Passer dans… » pour la changer de salle
            </li>
            <li>
              Les zones, elles, peuvent dépasser du contour et se redimensionner
              librement, clique dessus pour les régler
            </li>
          </ul>
        </div>
      </aside>
    </>
  );
}
