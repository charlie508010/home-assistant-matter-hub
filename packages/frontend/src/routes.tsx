import { lazy, type ReactNode, Suspense } from "react";
import type { RouteObject } from "react-router";
import { AppPage } from "./pages/AppPage.tsx";

const AreaBridgeSetupPage = lazy(() =>
  import("./pages/area-setup/AreaBridgeSetupPage.tsx").then((m) => ({
    default: m.AreaBridgeSetupPage,
  })),
);
const BridgeDetailsPage = lazy(() =>
  import("./pages/bridge-details/BridgeDetailsPage.tsx").then((m) => ({
    default: m.BridgeDetailsPage,
  })),
);
const BridgesPage = lazy(() =>
  import("./pages/bridges/BridgesPage.tsx").then((m) => ({
    default: m.BridgesPage,
  })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard/DashboardPage.tsx").then((m) => ({
    default: m.DashboardPage,
  })),
);
const DevicesPage = lazy(() =>
  import("./pages/devices/DevicesPage.tsx").then((m) => ({
    default: m.DevicesPage,
  })),
);
const CreateBridgePage = lazy(() =>
  import("./pages/edit-bridge/CreateBridgePage.tsx").then((m) => ({
    default: m.CreateBridgePage,
  })),
);
const EditBridgePage = lazy(() =>
  import("./pages/edit-bridge/EditBridgePage.tsx").then((m) => ({
    default: m.EditBridgePage,
  })),
);
const HealthPage = lazy(() =>
  import("./pages/health/HealthPage.tsx").then((m) => ({
    default: m.HealthPage,
  })),
);
const LabelsPage = lazy(() =>
  import("./pages/labels/LabelsPage.tsx").then((m) => ({
    default: m.LabelsPage,
  })),
);
const LockCredentialsPage = lazy(() =>
  import("./pages/lock-credentials/LockCredentialsPage.tsx").then((m) => ({
    default: m.LockCredentialsPage,
  })),
);
const NetworkMapPage = lazy(() =>
  import("./pages/network-map/NetworkMapPage.tsx").then((m) => ({
    default: m.NetworkMapPage,
  })),
);
const PluginsPage = lazy(() =>
  import("./pages/plugins/PluginsPage.tsx").then((m) => ({
    default: m.PluginsPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/settings/SettingsPage.tsx").then((m) => ({
    default: m.SettingsPage,
  })),
);
const StartupPage = lazy(() =>
  import("./pages/startup/StartupPage.tsx").then((m) => ({
    default: m.StartupPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage.tsx").then((m) => ({
    default: m.NotFoundPage,
  })),
);

const documentationUrl = "https://riddix.github.io/home-assistant-matter-hub";
export const navigation = {
  dashboard: "/",
  bridges: "/bridges",
  bridge: (bridgeId: string) => `/bridges/${bridgeId}`,
  createBridge: "/bridges/create",
  areaSetup: "/bridges/area-setup",
  editBridge: (bridgeId: string) => `/bridges/${bridgeId}/edit`,
  devices: "/devices",
  networkMap: "/network-map",
  health: "/health",
  labels: "/labels",
  filterPresets: "/labels",
  lockCredentials: "/lock-credentials",
  plugins: "/plugins",
  settings: "/settings",
  startup: "/startup",

  githubRepository: "https://github.com/riddix/home-assistant-matter-hub/",
  documentation: documentationUrl,
  support: `${documentationUrl}/support`,
  faq: {
    multiFabric: `${documentationUrl}/connect-multiple-fabrics`,
    bridgeConfig: `${documentationUrl}/bridge-configuration`,
  },
};

export const routes: RouteObject[] = [
  {
    path: "",
    element: <AppPage />,
    children: [
      {
        path: "",
        element: page(<DashboardPage />),
      },
      { path: navigation.bridges, element: page(<BridgesPage />) },
      { path: navigation.createBridge, element: page(<CreateBridgePage />) },
      { path: navigation.areaSetup, element: page(<AreaBridgeSetupPage />) },
      {
        path: navigation.bridge(":bridgeId"),
        element: page(<BridgeDetailsPage />),
      },
      {
        path: navigation.editBridge(":bridgeId"),
        element: page(<EditBridgePage />),
      },
      { path: navigation.devices, element: page(<DevicesPage />) },
      { path: navigation.networkMap, element: page(<NetworkMapPage />) },
      { path: navigation.health, element: page(<HealthPage />) },
      { path: navigation.labels, element: page(<LabelsPage />) },
      {
        path: navigation.lockCredentials,
        element: page(<LockCredentialsPage />),
      },
      { path: navigation.plugins, element: page(<PluginsPage />) },
      { path: navigation.settings, element: page(<SettingsPage />) },
      { path: navigation.startup, element: page(<StartupPage />) },
      { path: "*", element: page(<NotFoundPage />) },
    ],
  },
];

function page(element: ReactNode) {
  return <Suspense fallback={null}>{element}</Suspense>;
}
