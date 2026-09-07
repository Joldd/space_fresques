import Link from "next/link";

const steps = [
  {
    emoji: "📐",
    title: "Dessine ta salle",
    text: "Renseigne juste la largeur et la profondeur de ton espace, en mètres. Simple comme bonjour.",
  },
  {
    emoji: "🪑",
    title: "Ajoute ton mobilier",
    text: "Tables et chaises, aux dimensions que tu veux. Un clic pour ajouter, un autre pour retirer.",
  },
  {
    emoji: "🤲",
    title: "Dispose à ton rythme",
    text: "Glisse-dépose, sélectionne plusieurs éléments d'un coup, fais pivoter tes tables. Zéro stress.",
  },
];

export default function Home() {
  return (
    <div className="relative flex-1 overflow-hidden bg-sand">
      {/* décor organique en fond, purement esthétique */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sage/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-terracotta/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-sage/20 blur-3xl"
      />

      <main className="relative mx-auto flex max-w-5xl flex-col items-center gap-24 px-6 py-20 sm:py-28">
        <section className="flex flex-col items-center gap-6 text-center">
          <span className="rounded-full bg-white/70 dark:bg-white/10 px-4 py-1.5 text-sm text-sage-dark border border-sand-dark">
            Pensé pour les assos qui organisent des events 🎉
          </span>
          <h1 className="font-heading text-4xl sm:text-6xl leading-tight text-sage-dark max-w-3xl">
            Organise ta salle, sans prise de tête
          </h1>
          <p className="max-w-xl text-base sm:text-lg text-foreground/70">
            Un outil tout simple pour imaginer la disposition de tes tables et
            chaises avant le jour J. Glisse, dépose, ajuste — à ton rythme,
            en toute décontraction.
          </p>
          <Link
            href="/planner"
            className="mt-2 rounded-full bg-sage-dark px-8 py-3.5 text-white font-medium shadow-lg shadow-sage-dark/20 hover:bg-sage transition-colors"
          >
            Créer mon plan →
          </Link>
        </section>

        <section className="grid w-full gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="flex flex-col gap-3 rounded-3xl bg-white/70 dark:bg-white/5 border border-sand-dark p-6 text-center shadow-sm"
            >
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sand-dark text-2xl">
                {step.emoji}
              </span>
              <h2 className="font-heading text-lg text-sage-dark">
                {i + 1}. {step.title}
              </h2>
              <p className="text-sm text-foreground/70">{step.text}</p>
            </div>
          ))}
        </section>

        <section className="text-center text-sm text-foreground/50">
          <p>Fait avec 🌿 pour les bénévoles qui préfèrent l&apos;ambiance à la paperasse.</p>
        </section>
      </main>
    </div>
  );
}
