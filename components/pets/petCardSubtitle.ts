import type { Doc } from "@/convex/_generated/dataModel";

const SPECIES_LABEL: Record<Doc<"pets">["species"], string> = {
  dog: "Dog",
  cat: "Cat",
  other: "Other",
};

/**
 * Compact metadata line for a pet card: breed (or species) · age · sex ·
 * fixed-status · weight. Empty parts are skipped so short profiles stay clean.
 */
export function formatSubtitle(pet: Doc<"pets">): string {
  const parts: string[] = [];
  if (pet.breed?.trim()) parts.push(pet.breed.trim());
  else parts.push(SPECIES_LABEL[pet.species]);
  const age = formatAge(pet.birthDate);
  if (age) parts.push(age);
  if (pet.sex) parts.push(pet.sex === "female" ? "Female" : "Male");
  if (pet.isFixed) {
    if (pet.sex === "female") parts.push("Spayed");
    else if (pet.sex === "male") parts.push("Neutered");
    else parts.push("Fixed");
  }
  if (pet.sizeLb !== undefined) parts.push(`${pet.sizeLb} lb`);
  return parts.join(" · ");
}

function formatAge(birthDate?: string): string | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  const now = new Date();
  if (birth.getTime() > now.getTime()) return null;
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years === 0) {
    if (months <= 0) return "<1 mo";
    return `${months} mo`;
  }
  return years === 1 ? "1 yr" : `${years} yrs`;
}
