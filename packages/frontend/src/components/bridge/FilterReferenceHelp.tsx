import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

export function FilterReferenceHelp() {
  const { t } = useTranslation();
  const examples = t("filterReference.examples", {
    returnObjects: true,
  }) as Array<{ type: string; value: string; description: string }>;

  return (
    <Accordion variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <HelpOutlineIcon fontSize="small" sx={{ mr: 1 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          {t("filterReference.title")}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Typography variant="body2">
            {t("filterReference.includeExclude")}
          </Typography>
          <Typography variant="body2">
            {t("filterReference.includeMode")}
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            {examples.map((example) => (
              <Box
                key={`${example.type}-${example.value}`}
                display="flex"
                gap={1}
                alignItems="center"
                flexWrap="wrap"
              >
                <Chip label={example.type} size="small" variant="outlined" />
                <Typography variant="body2" fontFamily="monospace">
                  {example.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {example.description}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
