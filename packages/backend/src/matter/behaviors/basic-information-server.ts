import crypto from "node:crypto";
import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { VendorId } from "@matter/main";
import { BridgedDeviceBasicInformationServer as Base } from "@matter/main/behaviors";
import { BridgeDataProvider } from "../../services/bridges/bridge-data-provider.js";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { sanitizeMatterString } from "../../utils/sanitize-matter-string.js";
import { trimToLength } from "../../utils/trim-to-length.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";

export class BasicInformationServer extends Base {
  override async initialize(): Promise<void> {
    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update, { offline: true });
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state || !entity.state.attributes) {
      return;
    }
    const { basicInformation, featureFlags } = this.env.get(BridgeDataProvider);
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const device = entity.deviceRegistry;
    const mapping = homeAssistant.state.mapping;
    const registryName = featureFlags?.preferEntityRegistryName
      ? (entity.registry?.name ?? entity.registry?.original_name)
      : undefined;
    const nodeLabel =
      ellipse(32, homeAssistant.state.customName) ??
      ellipse(32, registryName) ??
      ellipse(32, entity.state?.attributes?.friendly_name) ??
      ellipse(32, entity.entity_id);
    const productNameFromNodeLabel =
      featureFlags?.productNameFromNodeLabel === true
        ? (ellipse(32, sanitizeMatterString(nodeLabel ?? "")) ?? undefined)
        : undefined;
    const serialNumberSuffix =
      this.env.get(BridgeDataProvider).serialNumberSuffix;
    // Reserve room for the suffix so it survives the 32-char cap; otherwise
    // appending and then trimming chops the suffix off (#330).
    const maxRawLen = 32 - (serialNumberSuffix?.length ?? 0);
    const registrySerial = featureFlags?.useHaRegistrySerial
      ? ellipse(maxRawLen, device?.serial_number)
      : undefined;
    const rawSerial =
      ellipse(maxRawLen, mapping?.customSerialNumber) ??
      registrySerial ??
      hash(maxRawLen, entity.entity_id);
    const serialNumber =
      rawSerial && serialNumberSuffix
        ? `${rawSerial}${serialNumberSuffix}`
        : rawSerial;
    const customVendorId = mapping?.customVendorId;
    const vendorId = isValidVendorId(customVendorId)
      ? customVendorId
      : basicInformation.vendorId;
    applyPatchState(this.state, {
      vendorId: VendorId(vendorId),
      vendorName:
        ellipse(32, mapping?.customVendorName) ??
        ellipse(32, device?.manufacturer) ??
        hash(32, basicInformation.vendorName),
      productName:
        ellipse(32, mapping?.customProductName) ??
        productNameFromNodeLabel ??
        ellipse(32, device?.model_id) ??
        ellipse(32, device?.model) ??
        hash(32, basicInformation.productName),
      productLabel:
        ellipse(64, device?.model) ?? hash(64, basicInformation.productLabel),
      hardwareVersion: basicInformation.hardwareVersion,
      softwareVersion: basicInformation.softwareVersion,
      hardwareVersionString: ellipse(64, device?.hw_version),
      softwareVersionString: ellipse(64, device?.sw_version),
      nodeLabel,
      reachable:
        entity.state?.state != null && entity.state.state !== "unavailable",
      serialNumber,
      // UniqueId helps controllers (especially Alexa) identify devices across
      // multiple fabric connections. Using MD5 hash of entity_id for stability.
      uniqueId: crypto
        .createHash("md5")
        .update(entity.entity_id)
        .digest("hex")
        .substring(0, 32),
    });
  }
}

function ellipse(maxLength: number, value?: string) {
  return trimToLength(value, maxLength, "...");
}

function hash(maxLength: number, value?: string) {
  const hashLength = 4;
  const suffix = crypto
    .createHash("md5")
    .update(value ?? "")
    .digest("hex")
    .substring(0, hashLength);
  return trimToLength(value, maxLength, suffix);
}

function isValidVendorId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 0xfffe
  );
}
