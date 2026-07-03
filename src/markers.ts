export type MarkerValidationInput = {
  addonName: string;
  expectedMarker?: string;
  expectedMarkers?: string[];
};

export function defaultAddonMarker(addonName: string): string {
  return `[DOTA_WORKSHOP_MCP] addon loaded: ${addonName}`;
}

export function expectedMarkerList(input: MarkerValidationInput): string[] {
  if (input.expectedMarkers && input.expectedMarkers.length > 0) {
    return input.expectedMarkers;
  }

  return [input.expectedMarker ?? defaultAddonMarker(input.addonName)];
}

export function findLuaStartupError(lines: string[]): string | undefined {
  return lines.find((line) => /script runtime error|syntax error|lua/i.test(line) && /error/i.test(line));
}

export function missingMarkers(lines: string[], markers: string[]): string[] {
  return markers.filter((marker) => !lines.some((line) => line.includes(marker)));
}

export function markerFoundEvidence(addonName: string, markers: string[]): string[] {
  const defaultMarker = defaultAddonMarker(addonName);

  if (markers.length === 1 && markers[0] === defaultMarker) {
    return [`found validation marker for ${addonName}`];
  }

  return markers.map((marker) => `found validation marker: ${marker}`);
}

