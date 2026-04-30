export type JourneyType = "Delivery" | "Collection" | "Runner";

export type JourneyStatus = "active" | "completed";
export type JourneyStartOriginType = "branch" | "gps";
export type JourneyCorrectionReason =
  | "forgot_to_end"
  | "forgot_to_start"
  | "app_issue"
  | "other";

export type JourneyCorrectionEntry = {
  editedAt: Date;
  editedByUid: string;
  editedByDriverId: string;
  reason: JourneyCorrectionReason;
  note: string | null;
  previousStartTime: Date;
  newStartTime: Date;
  previousEndTime: Date | null;
  newEndTime: Date | null;
};

/** Normalized journey for UI + Firestore mapping */
export type JourneyRecord = {
  id: string;
  userId: string;
  driverId: string;
  driverName: string;
  journeyType: JourneyType;
  vehicleRegistration: string;
  startingMileage: number;
  endingMileage: number | null;
  destinationPostcode: string | null;
  homeBranch: string;
  startOriginType?: JourneyStartOriginType | null;
  startOriginLabel?: string | null;
  startTime: Date;
  endTime: Date | null;
  status: JourneyStatus;
  wasCancelled?: boolean;
  createdAt: Date;
  milesTraveled: number | null;
  durationSeconds: number | null;
  isLateEntry?: boolean;
  needsReview?: boolean;
  isApproved?: boolean | null;
  certifiedVehicleMake?: string | null;
  certifiedVehicleModel?: string | null;
  certifiedVehicleColor?: string | null;
  correctionLog: JourneyCorrectionEntry[];
};
