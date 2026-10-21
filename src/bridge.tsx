/** @jsxImportSource preact */
import { useEffect } from "preact/hooks";

export function PreviewHostBridge() {
  useEffect(() => {
    if (!import.meta.env.DEV || window.parent === window) return;
    let dispose = () => {};
    let alive = true;
    void import("@/lib/preview-host-bridge").then((mod) => {
      if (!alive) return;
      dispose = mod.installPreviewHostBridge({
        getRoutePaths: () => ["/"],
      });
    });
    return () => {
      alive = false;
      dispose();
    };
  }, []);
  return null;
}
