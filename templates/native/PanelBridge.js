// MN 里所有插件的原生 JS 共用一个全局环境，同名的顶层函数会互相覆盖。
// 所以模块包在闭包里，只在 MNRails 下按 addonid 登记；ObjC 类名也按 addonid 区分。
var MNRails = MNRails || {};

MNRails["__ADDON_ID__"] = (function () {
  function className(addonid) {
    // 非字母数字（含 _）逐个转成 _ 加十六进制，不同 addonid 不会撞成同一个类名
    return "MNPanelAddon_" + addonid.replace(/[^A-Za-z0-9]/g, function (c) {
      return "_" + c.charCodeAt(0).toString(16);
    });
  }

  function createPanelAddon(addonid, mainPath) {
    return JSB.defineClass(
      className(addonid) + " : JSExtension",
      {
        sceneWillConnect: function () {
          self.addonid = addonid;
          self.mainPath = mainPath;
          self.panel = null;
        },

        sceneDidDisconnect: function () {
          if (self.panel) {
            self.panel.teardown();
            self.panel = null;
          }
        },

        notebookWillOpen: function () {
          self.openPanel();
        },

        controllerWillLayoutSubviews: function (controller) {
          if (controller === Application.sharedInstance().studyController(self.window)) {
            self.layout();
          }
        },

        openPanel: function () {
          if (!self.panel) {
            self.panel = AddonWebPanel.panel();
            if (!self.panel) {
              throw new Error(
                "无法创建面板：当前不在沉浸模式，或模板 plugins 名单没有 " + self.addonid,
              );
            }
            self.panel.panelWidth = 420;
            self.panel.maxContentHeight = 680;
            self.panel.onMessage = function (name, payload) {
              if (name === "ping") {
                return { ok: true, payload: payload ?? null };
              }
              if (name === "__closed__") {
                self.panel = null;
                self.refreshCommands();
                return {};
              }
              throw new Error(`未知的面板命令：${name}`);
            };
            if (!self.panel.loadPanel()) {
              throw new Error(`无法加载面板：${self.mainPath}/index.html`);
            }
          }

          self.panel.showFloatingIn(
            Application.sharedInstance().studyController(self.window),
          );
        },

        layout: function () {
          if (!self.panel) return;
          self.panel.showFloatingIn(
            Application.sharedInstance().studyController(self.window),
          );
        },

        queryAddonCommandStatus: function () {
          return {
            image: "icon.png",
            object: self,
            selector: "togglePanel:",
            checked: Boolean(self.panel && self.panel.floatingVisible),
          };
        },

        togglePanel: function () {
          if (self.panel && self.panel.floatingVisible) {
            self.panel.hideFloating();
            self.panel = null;
            self.refreshCommands();
            return;
          }
          self.openPanel();
          self.refreshCommands();
        },

        refreshCommands: function () {
          var controller = Application.sharedInstance().studyController(self.window);
          if (controller) {
            controller.refreshAddonCommands();
          }
        },
      },
    );
  }

  return { createPanelAddon: createPanelAddon };
})();
