import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { JourneyRecord } from "@/types/journey";

function formatTimeHm(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function buildDailyBranchPdf(params: {
  branch: string;
  date: Date;
  journeys: JourneyRecord[];
}): Promise<Uint8Array> {
  const { branch, date, journeys } = params;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const dateStr = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let y = 800;
  const left = 50;
  const line = 14;

  page.drawText("RunnerSheet — Daily branch report", {
    x: left,
    y,
    size: 16,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= line * 2;

  page.drawText(`Branch: ${branch}`, { x: left, y, size: 11, font });
  y -= line;
  page.drawText(`Date: ${dateStr}`, { x: left, y, size: 11, font });
  y -= line * 2;

  const dayJourneys = journeys
    .filter((j) => {
      const t = j.endTime ?? j.startTime;
      return (
        t.getFullYear() === date.getFullYear() &&
        t.getMonth() === date.getMonth() &&
        t.getDate() === date.getDate()
      );
    })
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  page.drawText(`Journeys: ${dayJourneys.length}`, {
    x: left,
    y,
    size: 11,
    font: bold,
  });
  y -= line * 2;

  for (const j of dayJourneys.slice(0, 45)) {
    const from = formatTimeHm(j.startTime);
    const to = j.endTime ? formatTimeHm(j.endTime) : "—";
    const lineText = `${j.driverName} · ${j.vehicleRegistration} · ${j.journeyType} · ${from}–${to}`;
    page.drawText(lineText.substring(0, 95), {
      x: left,
      y,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= line;
    if (y < 72) break;
  }

  if (dayJourneys.length === 0) {
    page.drawText("No completed journeys for this branch and date.", {
      x: left,
      y,
      size: 11,
      font,
    });
  }

  return pdf.save();
}
