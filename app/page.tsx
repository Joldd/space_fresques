import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col justify-center items-center h-[100vh] gap-5 ">
      <h1 className="text-2xl">Bienvenue</h1>
      <Link className="bg-amber-500 rounded-2xl p-5 hover:underline" href="/dashboard">Créer votre plan</Link>
    </div>
  );
}
