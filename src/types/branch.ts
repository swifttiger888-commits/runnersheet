/** Firestore `branches/{id}` — `name` is the canonical value stored on journeys (`homeBranch`). */
export type BranchRecord = {
  id: string;
  name: string;
  postcode: string;
};
