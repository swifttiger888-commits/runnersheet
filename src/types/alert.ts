export type AlertType =
  | "HighMileage"
  | "MultipleLateEntries"
  | "DuplicateVehicleUse"
  | "TimeDistanceMismatch";

export type AlertRecord = {
  id: string;
  alertType: AlertType;
  message: string;
  journeyId: string;
  driverEmployeeID: string;
  createdAt: Date;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: Date | null;
};
