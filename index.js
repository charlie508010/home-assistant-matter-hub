import fs from "node:fs";
import AlexaCookie from "alexa-cookie2";

const DATA_DIR = "/config/data";
const SQLITE_DIR = "/config/data/sqlite";
const COOKIE_FILE = `${SQLITE_DIR}/alexa-cookie.json`;
const STATUS_FILE = `${SQLITE_DIR}/alexa-login-status.json`;
const MAP_FILE = `${SQLITE_DIR}/alexa-peer-map.json`;
const PEERS_FILE = `${SQLITE_DIR}/matter-peers.json`;

let loginRunning = false;

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeStatus(status) {
  writeJson(STATUS_FILE, {
    ...status,
    updatedAt: new Date().toISOString()
  });
}

function getLoginUrl(config) {
  const host = config.proxyHost || "172.20.48.110";
  const port = Number(config.proxyPort || 36701);
  return `http://${host}:${port}/`;
}

export default class AlexaPeerResolverPlugin {
  name = "alexa-peer-resolver";
  version = "0.0.19";

  constructor(config = {}) {
    this.config = config;
  }

  getConfigSchema() {
    return {
      title: "Alexa Peer Resolver",
      description: "Amazon Login läuft über lokalen Browser-Proxy. Zugangsdaten werden nicht gespeichert.",
      properties: {
        enabled: {
          type: "boolean",
          title: "Enable Alexa integration",
          default: true
        },
        amazonDomain: {
          type: "select",
          title: "Amazon Region",
          default: "amazon.de",
          options: [
            { label: "Germany", value: "amazon.de" },
            { label: "USA", value: "amazon.com" },
            { label: "UK", value: "amazon.co.uk" }
          ]
        },
        proxyHost: {
          type: "string",
          title: "Login Proxy Host",
          default: "172.20.48.110"
        },
        proxyPort: {
          type: "number",
          title: "Login Proxy Port",
          default: 36701
        },
        scanInterval: {
          type: "number",
          title: "Scan interval minutes",
          default: 30
        }
      }
    };
  }

  getUiStatus() {
    const status = readJson(STATUS_FILE, {
      connected: fs.existsSync(COOKIE_FILE),
      status: fs.existsSync(COOKIE_FILE) ? "connected" : "login_required"
    });

    const peers = readJson(PEERS_FILE, []);
    const map = readJson(MAP_FILE, {});
    let matched = 0;

    for (const peer of peers) {
      const mac = String(peer.mac || "").replace(/:$/, "").toUpperCase();
      if (map[mac]) matched++;
    }

    const connected = status.connected === true || fs.existsSync(COOKIE_FILE);
    const loginUrl = getLoginUrl(this.config);

    return {
      status: connected ? "connected" : "offline",
      statusText: connected ? "Verbunden" : "Offline",
      statusColor: connected ? "success" : "warning",
      matchedDevices: matched,
      totalDevices: peers.length,
      actions: connected
        ? [
            {
              id: "deleteCookie",
              label: "Delete Verbindung",
              color: "error",
              variant: "outlined"
            }
          ]
        : [
            {
              id: "startLogin",
              label: "Amazon Login",
              color: "primary",
              variant: "contained",
              externalPopupUrl: loginUrl,
              externalPopupMode: "saveThenOpen"
            }
          ]
    };
  }

  async onAction(actionId) {
    if (actionId === "deleteCookie") {
      try { fs.unlinkSync(COOKIE_FILE); } catch {}
      try { fs.unlinkSync(`${DATA_DIR}/alexa-cookie.json`); } catch {}
      writeStatus({
        connected: false,
        status: "cookie_deleted",
        loginUrl: getLoginUrl(this.config)
      });
      return;
    }

    if (actionId === "startLogin") {
      this.startProxyLogin();
    }
  }

  async onConfigChanged(config) {
    this.config = config;
  }

  startProxyLogin() {
    if (loginRunning) {
      writeStatus({
        connected: fs.existsSync(COOKIE_FILE),
        status: "login_already_running",
        loginUrl: getLoginUrl(this.config)
      });
      return;
    }

    loginRunning = true;

    const proxyHost = this.config.proxyHost || "172.20.48.110";
    const proxyPort = Number(this.config.proxyPort || 36701);
    const loginUrl = getLoginUrl(this.config);

    writeStatus({
      connected: false,
      status: "proxy_login_required",
      loginUrl
    });

    AlexaCookie.generateAlexaCookie(
      {
        amazonPage: this.config.amazonDomain || "amazon.de",
        acceptLanguage: "de-DE",
        setupProxy: true,
        proxyOwnIp: proxyHost,
        proxyPort,
        proxyOnly: true
      },
      (err, result) => {
        loginRunning = false;

        if (err) {
          writeStatus({
            connected: false,
            status: "login_failed",
            loginUrl,
            error: String(err?.message || err)
          });
          return;
        }

        writeJson(COOKIE_FILE, result);

        try {
          fs.copyFileSync(COOKIE_FILE, `${DATA_DIR}/alexa-cookie.json`);
        } catch {}

        writeStatus({
          connected: true,
          status: "connected",
          loginUrl,
          amazonDomain: this.config.amazonDomain || "amazon.de"
        });
      }
    );
  }

  async onStart(context) {
    context.log.info("Alexa Peer Resolver plugin started");

    const status = readJson(STATUS_FILE, {
      connected: fs.existsSync(COOKIE_FILE),
      status: fs.existsSync(COOKIE_FILE) ? "connected" : "login_required"
    });

    context.log.info(
      `Alexa login status: ${status.status} connected=${status.connected === true || fs.existsSync(COOKIE_FILE)}`
    );

    const peers = readJson(PEERS_FILE, []);
    const map = readJson(MAP_FILE, {});
    let mapped = 0;

    for (const peer of peers) {
      const mac = String(peer.mac || "").replace(/:$/, "").toUpperCase();
      const entry = map[mac];
      if (!entry) continue;
      mapped++;
      context.log.info(
        `Alexa peer mapped: peer=${peer.peer} name="${entry.name}" serial=${entry.serial} ip=${peer.ip} mac=${mac} host=${peer.host ?? "unknown"}`
      );
    }

    context.log.info(`Alexa Peer Resolver scan complete: mapped=${mapped} total=${peers.length}`);
  }

  async onShutdown(reason) {}
}
