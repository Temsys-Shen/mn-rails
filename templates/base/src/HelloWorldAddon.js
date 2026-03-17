function createHelloWorldAddon(mainPath) {
  return JSB.defineClass(
    "MNHelloWorldAddon : JSExtension",
    {
      sceneWillConnect: function () {
        self.mainPath = mainPath;
        console.log("[HelloWorld] initialized");
      },
      sceneDidDisconnect: function () {
        console.log("[HelloWorld] disconnected");
      },
      queryAddonCommandStatus: function () {
        return {
          image: "icon.png",
          object: self,
          selector: "sayHello:",
          checked: false,
        };
      },
      sayHello: function () {
        console.log("[HelloWorld] Hello, MarginNote!");
      },
    },
  );
}
