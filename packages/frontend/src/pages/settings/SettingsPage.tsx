import LanIcon from "@mui/icons-material/Lan";
import SecurityIcon from "@mui/icons-material/Security";
import SettingsIcon from "@mui/icons-material/Settings";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { BackupRestore } from "../../components/backup/BackupRestore.tsx";
import { NetworkDiagnosticCard } from "../../components/health/NetworkDiagnosticCard.tsx";
import { UpdateChecker } from "../../components/system/UpdateChecker.tsx";

export const SettingsPage = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        <SettingsIcon sx={{ mr: 1, verticalAlign: "middle" }} />
        {t("settings.title")}
      </Typography>

      <BackupRestore />

      <Divider sx={{ my: 3 }} />

      <UpdateChecker />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>
        <LanIcon sx={{ mr: 1, verticalAlign: "middle", fontSize: 20 }} />
        {t("settings.network")}
      </Typography>
      <NetworkDiagnosticCard />

      <Divider sx={{ my: 3 }} />

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <SecurityIcon
              sx={{ mr: 1, verticalAlign: "middle", fontSize: 20 }}
            />
            {t("settings.httpAuthTitle")}
          </Typography>
          <Alert severity="info" variant="outlined">
            {t("settings.httpAuthManagedExternally")}
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
};
