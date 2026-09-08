import type { Animator, GoogleSheetsResponse } from "./types";

const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID;
const API_KEY = process.env.NEXT_PUBLIC_SHEETS_API_KEY;
const RANGE = "Feuille%201";

export async function getAnimators(): Promise<Animator[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur lors du chargement des animateurs");

  const data: GoogleSheetsResponse = await res.json();
  if (!data.values || data.values.length === 0) {
    return [];
  }
  const [headers, ...rows] = data.values;

  return rows.map((row) => {
    const animator: Animator = {};
    headers.forEach((header, i) => {
      animator[header] = row[i] ?? "";
    });
    return animator;
  });
}
