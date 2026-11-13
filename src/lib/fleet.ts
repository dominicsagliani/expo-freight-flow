export const EQUIPMENT_CLASSES = { forklift: "Forklift", reach_truck: "Reach truck", telehandler: "Telehandler", pallet_jack: "Pallet jack" } as const;
export const FUEL_TYPES = { unspecified: "Unspecified", electric: "Electric", propane: "Propane", diesel: "Diesel", manual: "Manual" } as const;
export function loadFits(capacity: number | null, weights: number[]) {
  return capacity !== null && capacity > 0 && weights.length > 0 && weights.every(w => w > 0) && weights.reduce((sum, w) => sum + w, 0) <= capacity;
}