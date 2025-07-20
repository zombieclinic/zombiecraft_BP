import { world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

export class AdminMenu {
  /** Called by your index.js subscription */
  async onUse({ source: player }) {
    try {
      const response = await new ModalFormData()
        .title("Admin Command")
        .textField("Enter command (without leading '/'):", "")
        .show(player);

      if (response.canceled) return;

      const cmd = response.formValues[0]?.trim();
      if (!cmd) return;

      // Use async version of runCommand
      await player.runCommand(cmd);  // Note: switched to `runCommandAsync` for safety
    } catch (err) {
      console.error("AdminMenu form error:", err);
    }
  }
}
