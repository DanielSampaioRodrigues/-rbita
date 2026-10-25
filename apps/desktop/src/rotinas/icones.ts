import {
  Backpack, BedDouble, BookOpen, CalendarDays, Coffee, Footprints, GlassWater, Heart, House, Laptop, Moon, Music,
  Pill, Shirt, ShowerHead, Smartphone, Sun, Utensils, Wind, type LucideIcon,
} from "lucide-react";

/** Ícones que a pessoa pode escolher para cada passo. Nome literal ao lado, sempre. */
export const ICONES: Record<string, { icone: LucideIcon; nome: string }> = {
  copo: { icone: GlassWater, nome: "Água" },
  remedio: { icone: Pill, nome: "Remédio" },
  banho: { icone: ShowerHead, nome: "Banho" },
  cafe: { icone: Coffee, nome: "Café" },
  comida: { icone: Utensils, nome: "Comer" },
  roupa: { icone: Shirt, nome: "Roupa" },
  dormir: { icone: BedDouble, nome: "Dormir" },
  ler: { icone: BookOpen, nome: "Ler" },
  caminhar: { icone: Footprints, nome: "Caminhar" },
  computador: { icone: Laptop, nome: "Computador" },
  celular: { icone: Smartphone, nome: "Celular" },
  agenda: { icone: CalendarDays, nome: "Agenda" },
  casa: { icone: House, nome: "Casa" },
  sair: { icone: Backpack, nome: "Sair de casa" },
  musica: { icone: Music, nome: "Música" },
  respirar: { icone: Wind, nome: "Respirar" },
  cuidar: { icone: Heart, nome: "Cuidar de si" },
  manha: { icone: Sun, nome: "Manhã" },
  noite: { icone: Moon, nome: "Noite" },
};
