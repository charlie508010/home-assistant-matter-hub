import crypto from "node:crypto";
import type { BridgeData } from "@home-assistant-matter-hub/common";
import {
  DescriptorServer,
  IcdManagementServer,
  NetworkCommissioningServer,
  OtaSoftwareUpdateRequestorServer,
} from "@matter/main/behaviors";
import { NetworkCommissioning } from "@matter/main/clusters";
import { AggregatorEndpoint } from "@matter/main/endpoints";
import { type Node, ServerNode } from "@matter/main/node";
import { VendorId } from "@matter/main/types";
import { trimToLength } from "../trim-to-length.js";

const BridgeRootEndpoint = ServerNode.RootEndpoint.with(
  NetworkCommissioningServer.withFeatures(
    NetworkCommissioning.Feature.EthernetNetworkInterface,
  ),
  OtaSoftwareUpdateRequestorServer,
  IcdManagementServer,
  DescriptorServer.set({ endpointUniqueId: "root-0" }),
);

export type BridgeServerNodeConfig = Node.Configuration<
  typeof BridgeRootEndpoint
>;

export function createBridgeServerConfig(
  data: BridgeData,
): BridgeServerNodeConfig {
  const networkId = new Uint8Array(32);

  return {
    type: BridgeRootEndpoint,
    id: data.id,
    network: {
      port: data.port,
    },
    productDescription: {
      name: data.name,
      deviceType: AggregatorEndpoint.deviceType,
    },
    basicInformation: {
      uniqueId: data.id,
      nodeLabel: trimToLength(data.name, 32, "..."),
      vendorId: VendorId(data.basicInformation.vendorId),
      vendorName: data.basicInformation.vendorName,
      productId: data.basicInformation.productId,
      productName: data.basicInformation.productName,
      productLabel: data.basicInformation.productLabel,
      serialNumber: crypto
        .createHash("md5")
        .update(`serial-${data.id}`)
        .digest("hex")
        .substring(0, 32),
      hardwareVersion: data.basicInformation.hardwareVersion,
      softwareVersion: data.basicInformation.softwareVersion,
      hardwareVersionString: data.basicInformation.hardwareVersionString,
      softwareVersionString: data.basicInformation.softwareVersionString,
      ...(data.countryCode ? { location: data.countryCode } : {}),
    },
    subscriptions: {
      persistenceEnabled: false,
    },
    networkCommissioning: {
      maxNetworks: 1,
      interfaceEnabled: true,
      lastConnectErrorValue: 0,
      lastNetworkId: networkId,
      lastNetworkingStatus:
        NetworkCommissioning.NetworkCommissioningStatus.Success,
      networks: [{ networkId, connected: true }],
    },
  };
}
