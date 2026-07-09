// Mean Earth radius in km, standard constant used by the Haversine formula.
const EARTH_RADIUS_KM = 6371;

export interface GeoPoint {
  lat: number;
  lng: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}

export function findNearest<T extends GeoPoint>(
  origin: GeoPoint,
  candidates: readonly T[],
): { location: T; distanceKm: number } | null {
  let nearest: { location: T; distanceKm: number } | null = null;

  for (const candidate of candidates) {
    const distanceKm = haversineDistanceKm(origin, candidate);
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { location: candidate, distanceKm };
    }
  }

  return nearest;
}
