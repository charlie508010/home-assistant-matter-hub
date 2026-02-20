const vendorNames: Record<number, string> = {
  4362: "Samsung SmartThings",
  4417: "Tuya",
  4442: "LG ThinQ",
  4447: "Aqara",
  4448: "Amazon Alexa",
  4631: "Amazon Alexa",
  4937: "Apple Home",
  4996: "Apple (iCloud Keychain)",
  24582: "Google Home",
};

export function getVendorName(vendorId: number): string {
  return vendorNames[vendorId] ?? `Vendor ${vendorId}`;
}
