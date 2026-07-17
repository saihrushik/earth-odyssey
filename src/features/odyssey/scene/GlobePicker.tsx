"use client";

import { useOdyssey } from "../store/useOdyssey";
import { vector3ToLatLng } from "../lib/geo";

/**
 * Invisible sphere over the Earth that turns a click anywhere on the planet
 * into a dropped pin: raycast point → lat/lng → reverse geocode → customPin.
 * Hotspot pins call stopPropagation, so catalog clicks still win.
 */
export function GlobePicker() {
  const setCustomPin = useOdyssey((s) => s.setCustomPin);

  return (
    <mesh
      onClick={async (e) => {
        // OrbitControls drags end over the sphere too — only treat a
        // near-stationary pointer as a click (delta is px moved since down).
        if (e.delta > 6) return;
        e.stopPropagation();
        const { lat, lng } = vector3ToLatLng(e.point);

        // Provisional pin immediately; name refines when geocoding lands.
        setCustomPin({ name: "Locating…", lat, lng });
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&localityLanguage=en`,
          );
          const geo = (await res.json()) as {
            city?: string;
            locality?: string;
            principalSubdivision?: string;
            countryName?: string;
          };
          const name =
            geo.city || geo.locality || geo.principalSubdivision || geo.countryName || "Open water";
          // Ignore stale responses if the user has since clicked elsewhere.
          const current = useOdyssey.getState().customPin;
          if (current && Math.abs(current.lat - lat) < 1e-6) {
            useOdyssey.setState({
              customPin: {
                name,
                lat,
                lng,
                country: geo.countryName,
                region: geo.principalSubdivision,
              },
            });
          }
        } catch {
          const current = useOdyssey.getState().customPin;
          if (current && Math.abs(current.lat - lat) < 1e-6) {
            useOdyssey.setState({
              customPin: { name: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`, lat, lng },
            });
          }
        }
      }}
    >
      <sphereGeometry args={[1.001, 32, 32]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
