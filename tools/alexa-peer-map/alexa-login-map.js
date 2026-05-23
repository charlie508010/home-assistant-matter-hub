const AlexaRemote = require("alexa-remote2");
require("dotenv").config();

const alexa = new AlexaRemote();

const config = {
  email: process.env.ALEXA_EMAIL,
  password: process.env.ALEXA_PASSWORD,
  amazonPage: process.env.ALEXA_AMAZON_PAGE || "amazon.de",
  acceptLanguage: process.env.ALEXA_LANGUAGE || "de-DE",
  useWsMqtt: false,
  bluetooth: false,
  logger: console.log,
};

alexa.init(config, (err) => {
  if (err) {
    console.error("Alexa login failed:", err);
    process.exit(1);
  }

  alexa.getDevices((err, devices) => {
    if (err) {
      console.error("getDevices failed:", err);
      process.exit(1);
    }

    const result = devices.map((d) => ({
      name: d.accountName || d.deviceAccountId || d.name || d.serialNumber,
      serialNumber: d.serialNumber,
      deviceType: d.deviceType,
      deviceFamily: d.deviceFamily,
      macAddress: d.macAddress || d.macAddressId || null,
      softwareVersion: d.softwareVersion,
      online: d.online
    }));

    console.log(JSON.stringify(result, null, 2));
  });
});
