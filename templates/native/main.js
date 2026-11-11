JSB.require("PanelBridge");

JSB.newAddon = function (mainPath) {
  return MNRails["__ADDON_ID__"].createPanelAddon("__ADDON_ID__", mainPath);
};
