// lib/planner/slugify.ts

/** "Rue intérieure Saint-Paul" -> "rue-interieure-saint-paul", pour les noms de fichier exportés */
export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "plan"
  );
}
