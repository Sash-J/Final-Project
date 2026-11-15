import { assetUrl } from "../../config";
import { sendWebVitalMetric } from "../webVitalsReporter";
import { compressImageFile } from "../imageCompression";

describe("Phase 0 performance helpers", () => {
  const originalSendBeacon = navigator.sendBeacon;

  afterEach(() => {
    navigator.sendBeacon = originalSendBeacon;
    jest.restoreAllMocks();
  });

  test("assetUrl preserves external URLs and normalizes relative paths", () => {
    expect(assetUrl("")).toBe("");
    expect(assetUrl("monolith_hero.png")).toBe("/monolith_hero.png");
    expect(assetUrl("/dunes_background1.png")).toBe("/dunes_background1.png");
    expect(assetUrl("https://images.unsplash.com/photo-1")).toBe("https://images.unsplash.com/photo-1");
  });

  test("sendWebVitalMetric streams beacons with JSON Blob when sendBeacon is available", () => {
    const beaconMock = jest.fn().mockReturnValue(true);
    navigator.sendBeacon = beaconMock;

    sendWebVitalMetric({
      id: "v2-123",
      name: "LCP",
      value: 1450.25,
      delta: 1450.25,
      rating: "good",
      navigationType: "navigate",
    });

    expect(beaconMock).toHaveBeenCalledTimes(1);
    const [endpoint, body] = beaconMock.mock.calls[0];
    expect(endpoint).toMatch(/\/api\/telemetry\/web-vitals$/);
    expect(body).toBeInstanceOf(Blob);
    expect(body.type).toBe("application/json");
  });

  test("compressImageFile passes through non-image and SVG files unchanged", async () => {
    const pdfFile = new File(["%PDF-1.4"], "invoice.pdf", { type: "application/pdf" });
    const svgFile = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });

    expect(await compressImageFile(pdfFile)).toBe(pdfFile);
    expect(await compressImageFile(svgFile)).toBe(svgFile);
    expect(await compressImageFile(null)).toBeNull();
  });
});

