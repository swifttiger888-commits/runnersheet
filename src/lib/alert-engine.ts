import type { JourneyRecord } from "@/types/journey";
import type { AlertRecord } from "@/types/alert";

const MPH_HIGH = 100;
const MPH_LOW = 5;
const MILES_THRESHOLD = 30;

function hoursBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / 3_600_000;
}

/** Average mph from distance and duration */
function avgMph(miles: number, hours: number): number {
  if (hours <= 0) return 0;
  return miles / hours;
}

/**
 * Derive alert candidates from a newly completed journey + recent history.
 * Call with completed journey and same-day or recent journeys for duplicate check.
 */
export function alertsForCompletedJourney(
  completed: JourneyRecord,
  recentSameVehicle: JourneyRecord[],
): Array<Omit<AlertRecord, "id" | "createdAt" | "resolvedBy" | "resolvedAt">> {
  const out: Array<
    Omit<AlertRecord, "id" | "createdAt" | "resolvedBy" | "resolvedAt">
  > = [];

  if (!completed.endTime || completed.milesTraveled === null) return out;
  const completedEnd = completed.endTime;

  const hours = hoursBetween(completed.startTime, completedEnd);
  const mph = avgMph(completed.milesTraveled, hours);

  if (mph > MPH_HIGH) {
    out.push({
      alertType: "HighMileage",
      message: `Average speed ${mph.toFixed(0)} mph exceeds ${MPH_HIGH} mph for journey ${completed.vehicleRegistration}.`,
      journeyId: completed.id,
      driverEmployeeID: completed.driverId,
      isResolved: false,
    });
  }

  if (completed.milesTraveled > MILES_THRESHOLD && mph < MPH_LOW) {
    out.push({
      alertType: "TimeDistanceMismatch",
      message: `High distance (${completed.milesTraveled} mi) with very low average speed (${mph.toFixed(1)} mph).`,
      journeyId: completed.id,
      driverEmployeeID: completed.driverId,
      isResolved: false,
    });
  }

  const overlap = recentSameVehicle.filter((j) => {
    if (j.id === completed.id || !j.endTime) return false;
    if (j.vehicleRegistration !== completed.vehicleRegistration) return false;
    const rangesOverlap =
      completed.startTime < j.endTime && completedEnd > j.startTime;
    return rangesOverlap;
  });
  if (overlap.length > 0) {
    out.push({
      alertType: "DuplicateVehicleUse",
      message: `Vehicle ${completed.vehicleRegistration} may have overlapping journey times.`,
      journeyId: completed.id,
      driverEmployeeID: completed.driverId,
      isResolved: false,
    });
  }

  return out;
}

export function lateEntryAlert(
  driverEmployeeID: string,
  journeyId: string,
): Omit<AlertRecord, "id" | "createdAt" | "resolvedBy" | "resolvedAt"> {
  return {
    alertType: "MultipleLateEntries",
    message: `Late entry requires review (journey ${journeyId}).`,
    journeyId,
    driverEmployeeID,
    isResolved: false,
  };
}
