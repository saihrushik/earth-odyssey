import * as THREE from "three";

/**
 * Convert geographic coordinates to a position on a sphere whose
 * equirectangular texture is applied to a default three.js SphereGeometry.
 */
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Inverse of latLngToVector3 — surface point on the globe back to lat/lng. */
export function vector3ToLatLng(v: THREE.Vector3): { lat: number; lng: number } {
  const r = v.length();
  const phi = Math.acos(THREE.MathUtils.clamp(v.y / r, -1, 1));
  const theta = Math.atan2(v.z, -v.x);
  const lat = 90 - (phi * 180) / Math.PI;
  let lng = (theta * 180) / Math.PI - 180;
  if (lng < -180) lng += 360;
  return { lat, lng };
}

/** Great-circle distance in km between two lat/lng points (haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
