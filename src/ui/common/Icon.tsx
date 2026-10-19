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
  minus: "M5 12h14",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  folder: "M3 6h6l2 2h10v11H3z",
  save: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  file: "M6 3h9l4 4v14H6zM14 3v5h5",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
  ear: "M7 10a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0M10 10a2 2 0 0 1 4 0",
  wand: "M4 20 15 9M14 4v3M18 8h3M17 5l2-2M19 11l2 2",
  lines: "M3 18c4-8 7-8 9-4s5 4 9-4",
  grid: "M4 4h16v16H4zM4 12h16M12 4v16",
  guitar: "M14 4l6 6M17 7l-6 6M9 11a4 4 0 1 0 4 4",
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
