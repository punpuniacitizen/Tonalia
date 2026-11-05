// Iconos de trazo simple, dibujados a mano en SVG (sin librerías externas).

const PATHS = {
  play: "M7 4.5v15l12-7.5z",
  stop: "M6.5 6.5h11v11h-11z",
  rewind: "M6 5v14M19 5 9 12l10 7z",
  loop: "M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  wave: "M3 12h2l2-6 3 12 3-9 2 5 2-2h4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  speaker: "M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  chevronDown: "M6 9l6 6 6-6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  arp: "M3 19h4v-4h4v-4h4V7h4V4",
  blocks: "M3 8h5v11H3zM10 5h5v14h-5zM17 10h4v9h-4z",
  notes: "M4 6h6M9 11h7M6 16h5M14 18h6",
  wrench: "M14.6 6.4a4.5 4.5 0 0 1 5.6-2.9l-3 3 .5 2.4 2.4.5 3-3a4.5 4.5 0 0 1-6.1 5.4L9.4 19.4a2.1 2.1 0 0 1-3-3l7.6-7.6a4.5 4.5 0 0 1 .6-2.4z",
  magnet: "M5 4v7a7 7 0 0 0 14 0V4h-4v7a3 3 0 0 1-6 0V4zM5 8h4M15 8h4",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1",
  drum: "M4 11c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6M6 3l5 6.5M18 3l-5 6.5",
  bassClef: "M5 9a5 5 0 0 1 10 0c0 5-4.5 9-10 11M5 9a1.6 1.6 0 1 0 3.2 0A1.6 1.6 0 0 0 5 9M19 7.5v.5M19 11.5v.5",
  music: "M9 17.5V6l10-2v11.5M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
  pencil: "M4 20l1.2-4.2L15.5 5.5l3 3L8.2 18.8zM13.5 7.5l3 3",
  pointer: "M6 3.5l12 7.2-5.3 1.3-2.4 5.5z",
  velocity: "M5 19v-3M10 19v-7M15 19v-10M20 19V5",
  reset: "M4 5v5h5M5.1 15a7.5 7.5 0 1 0 .6-8.2L4 10",
  minus: "M5 12h14",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  folder: "M3 6h6l2 2h10v11H3z",
  save: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  file: "M6 3h9l4 4v14H6zM14 3v5h5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
  ear: "M7 10a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0M10 10a2 2 0 0 1 4 0",
  wand: "M4 20 15 9M14 4v3M18 8h3M17 5l2-2M19 11l2 2",
  lines: "M3 18c4-8 7-8 9-4s5 4 9-4",
  grid: "M4 4h16v16H4zM4 12h16M12 4v16",
  guitar: "M14 4l6 6M17 7l-6 6M9 11a4 4 0 1 0 4 4",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  shrink: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  cap: "M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
