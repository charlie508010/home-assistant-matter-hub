import { PowerTopologyServer as Base } from "@matter/main/behaviors";
import { PowerTopology } from "@matter/main/clusters";

export const HaPowerTopologyServer = Base.with(
  PowerTopology.Feature.NodeTopology,
);
