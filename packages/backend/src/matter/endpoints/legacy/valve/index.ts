import type { EndpointType } from "@matter/main";
import { ValveConfigurationAndControl } from "@matter/main/clusters";
import { WaterValveDevice } from "@matter/main/devices";
import { EntityStateProvider } from "../../../../services/bridges/entity-state-provider.js";
import { BasicInformationServer } from "../../../behaviors/basic-information-server.js";
import { HomeAssistantEntityBehavior } from "../../../behaviors/home-assistant-entity-behavior.js";
import { IdentifyServer } from "../../../behaviors/identify-server.js";
import { PowerSourceServer } from "../../../behaviors/power-source-server.js";
import { ValveConfigurationAndControlServer } from "../../../behaviors/valve-configuration-and-control-server.js";

const ValveServer = ValveConfigurationAndControlServer({
  getCurrentState: (state) => {
    switch (state.state) {
      case "open":
        return ValveConfigurationAndControl.ValveState.Open;
      case "opening":
      case "closing":
        return ValveConfigurationAndControl.ValveState.Transitioning;
      default:
        return ValveConfigurationAndControl.ValveState.Closed;
    }
  },
  open: () => ({ action: "valve.open_valve" }),
  close: () => ({ action: "valve.close_valve" }),
});

const ValveEndpointType = WaterValveDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  ValveServer,
);

const ValveWithBatteryEndpointType = WaterValveDevice.with(
  BasicInformationServer,
  IdentifyServer,
  HomeAssistantEntityBehavior,
  ValveServer,
  PowerSourceServer({
    getBatteryPercent: (entity, agent) => {
      const homeAssistant = agent.get(HomeAssistantEntityBehavior);
      const batteryEntity = homeAssistant.state.mapping?.batteryEntity;
      if (batteryEntity) {
        const stateProvider = agent.env.get(EntityStateProvider);
        const battery = stateProvider.getBatteryPercent(batteryEntity);
        if (battery != null) {
          return Math.max(0, Math.min(100, battery));
        }
      }

      const attrs = entity.attributes as {
        battery?: number;
        battery_level?: number;
      };
      const level = attrs.battery_level ?? attrs.battery;
      if (level == null || Number.isNaN(Number(level))) {
        return null;
      }
      return Number(level);
    },
  }),
);

export function ValveDevice(
  homeAssistantEntity: HomeAssistantEntityBehavior.State,
): EndpointType {
  const attrs = homeAssistantEntity.entity.state.attributes as {
    battery?: number;
    battery_level?: number;
  };
  const hasBatteryAttr = attrs.battery_level != null || attrs.battery != null;
  const hasBatteryEntity = !!homeAssistantEntity.mapping?.batteryEntity;

  const device =
    hasBatteryAttr || hasBatteryEntity
      ? ValveWithBatteryEndpointType
      : ValveEndpointType;

  return device.set({ homeAssistantEntity });
}
