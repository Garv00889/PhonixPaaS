import { PredictiveArcCanvas } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export function Scene() {
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;

  const mode =
    (searchParams?.get("mode") as "light" | "dark") || "light";
  const speed = searchParams?.has("speed")
    ? parseFloat(searchParams.get("speed")!)
    : 0.20;
  const hue = searchParams?.has("hue")
    ? parseFloat(searchParams.get("hue")!)
    : 0;
  const saturation = searchParams?.has("saturation")
    ? parseFloat(searchParams.get("saturation")!)
    : 1.0;
  const brightness = searchParams?.has("brightness")
    ? parseFloat(searchParams.get("brightness")!)
    : 1.0;

  return (
    <div className="shader-frame">
      <PredictiveArcCanvas
        variant="signal-particles"
        mode={mode}
        speed={speed}
        hue={hue}
        saturation={saturation}
        brightness={brightness}
      />
    </div>
  );
}
