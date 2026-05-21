---
title: Root Endpoint Stabilization
sidebar_position: 20
---

# Root Endpoint / Descriptor stabilization notes

Hey,

I cleaned up and grouped the recent changes into smaller and more understandable sections.

Most relevant changes are currently located in:

* `packages/backend/src/matter/endpoints/`
* `packages/backend/src/services/bridges/`
* `packages/backend/src/core/app/`
* `patches/@matter__node@0.16.11.patch`
* `apps/home-assistant-matter-hub/`

Main topics of this work:

* Root Endpoint / Descriptor stabilization
* OTA Requestor + ICD + NetworkCommissioning on EP0
* endpointUniqueId support
* improved Alexa/controller diagnostics
* storage/backup handling
* runtime/add-on version handling

The most important part was stabilizing the EP0 serverList and Descriptor reads.

Current EP0 serverList:

```text id="31lp7n"
40 BasicInformation
31 AccessControl
63 GroupKeyManagement
48 GeneralCommissioning
60 AdministratorCommissioning
62 OperationalCredentials
51 GeneralDiagnostics
49 NetworkCommissioning
42 OtaSoftwareUpdateRequestor
70 IcdManagement
29 Descriptor
```

This configuration currently behaves much more stable with Alexa/controllers.

Additional diagnostics were added to map controller reads directly to Home Assistant entities.

Example:

```text id="txe2sm"
Alexa/Controller read endpoint=37
endpointType=OnOffLight
entity=light.esszimmer_lichtschalter_esszimmer
cluster=Descriptor(0x1d)
attribute=serverList(0x1)
```

This makes it much easier to identify which Matter reads belong to which HA entities.

OTA also appears to be working correctly now. The logs show:

* OTA Provider announcements
* queryImage requests
* valid provider responses
* properly scheduled retry cycles

Example:

```text id="o4ll4s"
queryImage ... softwareVersion: 210818
status: 1 delayedActionTime: 600 userConsentNeeded: true
Scheduling OTA update query in 600000 (reason "Busy")
```

In the latest tests I currently do not see visible:

* UnsupportedCluster(195)
* UnsupportedAttribute(134)

Descriptor reads for:

* serverList
* deviceTypeList
* partsList
* endpointUniqueId

are now completing successfully.

The remaining work is mostly cleanup:

* UI/i18n
* frontend bundle size
* reducing verbose diagnostics
* smaller structural improvements

I would avoid further large Matter/Fabric/Descriptor architecture changes for now unless new real 195/134 issues appear again.


Hey,

ich habe die letzten Änderungen nochmal etwas aufgeräumt und in kleinere, nachvollziehbare Bereiche getrennt.

Die wichtigsten Änderungen liegen aktuell hauptsächlich in:

* `packages/backend/src/matter/endpoints/`
* `packages/backend/src/services/bridges/`
* `packages/backend/src/core/app/`
* `patches/@matter__node@0.16.11.patch`
* `apps/home-assistant-matter-hub/`

Die größeren Themen waren:

* Stabilisierung vom Root Endpoint / Descriptor Verhalten
* OTA Requestor + ICD + NetworkCommissioning auf EP0
* endpointUniqueId Unterstützung
* bessere Alexa-/Controller-Diagnostics
* Storage-/Backup-Anpassungen
* Runtime/Add-on Versionshandling

Der wichtigste Teil war letztlich die Stabilisierung der EP0 serverList und der Descriptor Reads.

Aktuelle serverList auf EP0:

```text
40 BasicInformation
31 AccessControl
63 GroupKeyManagement
48 GeneralCommissioning
60 AdministratorCommissioning
62 OperationalCredentials
51 GeneralDiagnostics
49 NetworkCommissioning
42 OtaSoftwareUpdateRequestor
70 IcdManagement
29 Descriptor
```

Damit sieht das Verhalten gegenüber Alexa/Controllern aktuell deutlich stabiler aus.

Zusätzlich habe ich Diagnostics eingebaut, damit man Controller-Reads endlich sauber zuordnen kann. Beispiel:

```text
Alexa/Controller read endpoint=37
endpointType=OnOffLight
entity=light.esszimmer_lichtschalter_esszimmer
cluster=Descriptor(0x1d)
attribute=serverList(0x1)
```

Dadurch kann man jetzt direkt sehen, welcher Matter-Read zu welcher HA-Entity gehört.

OTA scheint ebenfalls sauber zu laufen. Im Log sieht man:

* OTA Provider Announcements
* queryImage Requests
* gültige Provider Responses
* korrekt geplante Retry-Zyklen

Beispiel:

```text
queryImage ... softwareVersion: 210818
status: 1 delayedActionTime: 600 userConsentNeeded: true
Scheduling OTA update query in 600000 (reason "Busy")
```

Aktuell sehe ich in den letzten Tests keine sichtbaren:

* UnsupportedCluster(195)
* UnsupportedAttribute(134)

Die Descriptor Reads für:

* serverList
* deviceTypeList
* partsList
* endpointUniqueId

laufen inzwischen sauber durch.

Die letzten offenen Sachen sind eher Cleanup:

* UI/i18n
* Frontend bundle size
* Logging reduzieren
* kleinere Strukturverbesserungen

An der eigentlichen Matter-/Fabric-/Descriptor-Architektur würde ich im Moment möglichst wenig weiter umbauen, solange keine neuen echten 195/134 Fehler mehr auftauchen.

