import type { Environment } from "@matter/main";
import { MdnsService } from "@matter/main/protocol";
import { LoggerService } from "./logger.js";

export interface MdnsOptions {
  ipv4: boolean;
  networkInterface?: string;
}

export function mdns(env: Environment, options: MdnsOptions) {
  const logger = env.get(LoggerService).get("MDNS");
  env.vars.set("mdns.ipv4", options.ipv4);
  if (options.networkInterface) {
    env.vars.set("mdns.networkInterface", options.networkInterface);
  }
  logger.info(
    `mDNS network interface: ${options.networkInterface ?? "all"}`,
  );
  new MdnsService(env, {
    ipv4: options.ipv4,
    networkInterface: options.networkInterface,
  });
}
