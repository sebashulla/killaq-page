import type { Metadata } from "next";
import PersonalizedClient from "./PersonalizedClient";

export const metadata: Metadata = { title: "Atención personalizada | Killaq Joyería Fina", description: "Cuéntanos la joya que imaginas. Asesoría personal sobre diseño, materiales, tallas y detalles con Killaq." };
export default function PersonalizedPage() { return <PersonalizedClient />; }
