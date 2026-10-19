import { useEffect, useState } from "react";

import { api } from "./api";
import { useSong } from "./stores/song";
import { DragGhost } from "./ui/shell/DragGhost";
import { Header } from "./ui/shell/Header";
import { useShortcuts } from "./ui/shell/useShortcuts";
import { Timeline } from "./ui/timeline/Timeline";
import { WheelDock } from "./ui/wheel/WheelDock";
import "./App.css";

export default function App() {
  const load = useSong((s) => s.load);
  const error = useSong((s) => s.error);
  const clearError = useSong((s) => s.clearError);
  const [audioError, setAudioError] = useState<string | null>(null);
  useShortcuts();

  useEffect(() => {
    void load();
    void api.audioStatus().then(setAudioError);
  }, [load]);

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />
      <Header />
      <main className="stage">
        <Timeline />
        <WheelDock />
      </main>
      <DragGhost />
      {(error || audioError) && (
        <div className="toast" role="alert" onClick={clearError}>
          {error ?? `Audio: ${audioError}`}
        </div>
      )}
    </div>
  );
}
