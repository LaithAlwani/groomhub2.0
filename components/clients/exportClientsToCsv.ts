import type { ClientRow } from "./ClientsTable";

/**
 * Builds a CSV from the currently-loaded clients board and triggers a browser
 * download. The CSV mirrors the visible columns: name, phone, email, pets,
 * last visit, last appointment status, member-since year.
 *
 * Escapes any value containing a comma, quote or newline per RFC 4180 — wrap
 * in double quotes and double up any existing quote.
 */
export function exportClientsToCsv(rows: ReadonlyArray<ClientRow>): void {
  const header = [
    "Name",
    "Phone",
    "Email",
    "Pets",
    "Last Visit",
    "Last Status",
    "Member Since",
  ];
  const lines: string[] = [header.map(csvEscape).join(",")];

  for (const row of rows) {
    const pets = row.pets
      .map((pet) => (pet.breed ? `${pet.name} (${pet.breed})` : pet.name))
      .join("; ");
    const lastVisit = row.lastAppointment
      ? new Date(row.lastAppointment.startTime).toISOString().slice(0, 10)
      : "";
    const status = row.lastAppointment?.status ?? "";
    const memberSince = new Date(row.client._creationTime)
      .getFullYear()
      .toString();
    lines.push(
      [
        row.client.fullName,
        row.client.phone ?? "",
        row.client.email ?? "",
        pets,
        lastVisit,
        status,
        memberSince,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
