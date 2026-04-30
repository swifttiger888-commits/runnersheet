import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { JourneyRecord } from "@/types/journey";

function formatTimeHm(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDuration(durationSeconds: number | null | undefined): string {
  if (durationSeconds == null) return "-";
  const totalMinutes = Math.max(0, Math.round(durationSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function clampCell(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export async function buildDriverJourneyPdf(params: {
  branch: string;
  driverName: string;
  fromDate: Date;
  toDate: Date;
  journeys: JourneyRecord[];
}): Promise<Uint8Array> {
  const { branch, driverName, fromDate, toDate, journeys } = params;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const now = new Date();

  const rows = journeys
    .filter((j) => {
      if (j.status !== "completed" || !j.endTime) return false;
      if (j.homeBranch !== branch) return false;
      if (j.driverName !== driverName) return false;
      return j.endTime >= fromDate && j.endTime <= toDate;
    })
    .sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime());

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const left = 28;
  const topY = 815;
  const tableStartY = 700;
  const rowStep = 16;
  const bottomY = 52;

  const baseColumns = [
    { title: "Date", width: 68 },
    { title: "Start", width: 44 },
    { title: "End", width: 44 },
    { title: "Duration", width: 56 },
    { title: "Vehicle", width: 58 },
    { title: "Type", width: 52 },
    { title: "From", width: 96 },
    { title: "To", width: 96 },
    { title: "Status", width: 45 },
  ];

  const availableTableWidth = pageWidth - left * 2;
  const baseWidthTotal = baseColumns.reduce((sum, c) => sum + c.width, 0);
  const widthScale = baseWidthTotal > availableTableWidth ? availableTableWidth / baseWidthTotal : 1;
  const columns = baseColumns.map((c) => ({
    title: c.title,
    width: Number((c.width * widthScale).toFixed(2)),
  }));
  if (columns.length > 0) {
    const usedExceptLast = columns
      .slice(0, -1)
      .reduce((sum, c) => sum + c.width, 0);
    columns[columns.length - 1]!.width = Number(
      (availableTableWidth - usedExceptLast).toFixed(2),
    );
  }

  const rowCharCaps = columns.map((c) =>
    Math.max(4, Math.floor((c.width - 4) / 4.3)),
  );

  const drawPageHeader = (page: ReturnType<typeof pdf.addPage>) => {
    let y = topY;
    page.drawText("RunnerSheet - Driver Journey Report", {
      x: left,
      y,
      size: 14,
      font: bold,
      color: rgb(0.08, 0.08, 0.08),
    });
    y -= 18;
    page.drawText(`Driver: ${driverName}`, { x: left, y, size: 10, font: bold });
    y -= 13;
    page.drawText(`Branch: ${branch}`, { x: left, y, size: 10, font });
    y -= 13;
    page.drawText(
      `Range: ${formatDateShort(fromDate)} 00:00 -> ${formatDateShort(toDate)} 23:59`,
      { x: left, y, size: 10, font },
    );
    y -= 13;
    page.drawText(`Generated: ${now.toLocaleString("en-GB")}`, {
      x: left,
      y,
      size: 10,
      font,
    });
    y -= 18;
    page.drawText(`Rows: ${rows.length} (newest first)`, {
      x: left,
      y,
      size: 10,
      font: bold,
    });

    const headerBandY = tableStartY + 10;
    page.drawRectangle({
      x: left - 2,
      y: headerBandY - 14,
      width: pageWidth - left * 2 + 4,
      height: 14,
      color: rgb(0.93, 0.93, 0.93),
    });
    let x = left;
    for (const c of columns) {
      page.drawText(c.title, { x, y: headerBandY - 10, size: 8.5, font: bold });
      x += c.width;
    }
  };

  let page = pdf.addPage([pageWidth, pageHeight]);
  drawPageHeader(page);
  let y = tableStartY;

  for (const j of rows) {
    if (y < bottomY) {
      page = pdf.addPage([pageWidth, pageHeight]);
      drawPageHeader(page);
      y = tableStartY;
    }
    const row = [
      clampCell(formatDateShort(j.endTime!), rowCharCaps[0]!),
      clampCell(formatTimeHm(j.startTime), rowCharCaps[1]!),
      clampCell(formatTimeHm(j.endTime!), rowCharCaps[2]!),
      clampCell(formatDuration(j.durationSeconds), rowCharCaps[3]!),
      clampCell(j.vehicleRegistration || "-", rowCharCaps[4]!),
      clampCell(j.journeyType, rowCharCaps[5]!),
      clampCell(j.startOriginLabel ?? j.homeBranch ?? "-", rowCharCaps[6]!),
      clampCell(j.destinationPostcode ?? "Not set", rowCharCaps[7]!),
      clampCell(j.wasCancelled ? "Cancelled" : "Complete", rowCharCaps[8]!),
    ];

    let x = left;
    for (let i = 0; i < row.length; i += 1) {
      page.drawText(row[i], {
        x,
        y,
        size: 8.2,
        font,
        color:
          i === row.length - 1 && j.wasCancelled
            ? rgb(0.63, 0.18, 0.18)
            : rgb(0.15, 0.15, 0.15),
      });
      x += columns[i].width;
    }

    page.drawLine({
      start: { x: left - 2, y: y - 4 },
      end: { x: pageWidth - left + 2, y: y - 4 },
      thickness: 0.35,
      color: rgb(0.87, 0.87, 0.87),
    });
    y -= rowStep;
  }

  if (rows.length === 0) {
    page.drawText("No completed journeys for this driver in the selected range.", {
      x: left,
      y: tableStartY - 8,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  const pages = pdf.getPages();
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i += 1) {
    const p = pages[i];
    const footerY = 24;
    p.drawLine({
      start: { x: left - 2, y: footerY + 14 },
      end: { x: pageWidth - left + 2, y: footerY + 14 },
      thickness: 0.35,
      color: rgb(0.84, 0.84, 0.84),
    });
    p.drawText(`Page ${i + 1} of ${totalPages}`, {
      x: pageWidth / 2 - 28,
      y: footerY,
      size: 8.5,
      font,
      color: rgb(0.33, 0.33, 0.33),
    });
  }

  const lastPage = pages[totalPages - 1];
  const signY = 56;
  lastPage.drawText("Driver signature", {
    x: left,
    y: signY + 10,
    size: 8.5,
    font,
    color: rgb(0.33, 0.33, 0.33),
  });
  lastPage.drawLine({
    start: { x: left, y: signY },
    end: { x: left + 200, y: signY },
    thickness: 0.6,
    color: rgb(0.5, 0.5, 0.5),
  });
  lastPage.drawText("Manager signature", {
    x: pageWidth - left - 200,
    y: signY + 10,
    size: 8.5,
    font,
    color: rgb(0.33, 0.33, 0.33),
  });
  lastPage.drawLine({
    start: { x: pageWidth - left - 200, y: signY },
    end: { x: pageWidth - left, y: signY },
    thickness: 0.6,
    color: rgb(0.5, 0.5, 0.5),
  });

  return pdf.save();
}
