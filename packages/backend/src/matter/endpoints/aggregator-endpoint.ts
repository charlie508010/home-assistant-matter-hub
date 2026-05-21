import { Endpoint } from "@matter/main";
import { AggregatorEndpoint as AggregatorEndpointType } from "@matter/main/endpoints";
import { withStableEndpointUniqueId } from "./endpoint-unique-id.js";

export class AggregatorEndpoint extends Endpoint {
  constructor(id: string) {
    super(withStableEndpointUniqueId(AggregatorEndpointType, id), { id });
  }
}
