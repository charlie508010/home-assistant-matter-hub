import crypto from "node:crypto";
import type { EndpointType } from "@matter/main";
import { DescriptorServer } from "@matter/main/behaviors";

const MAX_ENDPOINT_UNIQUE_ID_LENGTH = 32;

export function createStableEndpointUniqueId(source: string): string {
  const normalized = source
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (
    normalized.length > 0 &&
    normalized.length <= MAX_ENDPOINT_UNIQUE_ID_LENGTH
  ) {
    return normalized;
  }

  return crypto
    .createHash("md5")
    .update(source)
    .digest("hex")
    .substring(0, MAX_ENDPOINT_UNIQUE_ID_LENGTH);
}

export function createStableEndpointId(
  source: string,
  suffix?: string,
): string {
  const raw = suffix ? `${source}_${suffix}` : source;
  return raw.replace(/\./g, "_").replace(/\s+/g, "_");
}

export function withStableEndpointUniqueId(
  type: EndpointType,
  source: string,
): EndpointType {
  const descriptor = DescriptorServer.set({
    endpointUniqueId: createStableEndpointUniqueId(source),
  });
  const mutable = type as EndpointType & {
    with(...behaviors: unknown[]): EndpointType;
  };

  if (typeof mutable.with === "function") {
    return mutable.with(descriptor);
  }

  return {
    ...type,
    behaviors: { ...type.behaviors, descriptor },
  } as EndpointType;
}
