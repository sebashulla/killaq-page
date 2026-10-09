export default function JewelrySketch({ kind }: { kind: string }) {
  return <svg viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    {kind === "anillos" ? <><ellipse cx="78" cy="92" rx="35" ry="39" transform="rotate(-30 78 92)" /><ellipse cx="78" cy="92" rx="30" ry="34" transform="rotate(-30 78 92)" /><path d="m50 46 18-10 18 12-9 23-20-2-7-23Z M50 46l27 25M68 36l9 35M86 48l-29 21M50 46l36 2" /></>
    : kind === "collares" ? <><path d="M36 33c-16 79 2 95 44 97 42-2 60-18 44-97M40 33c-14 74 3 90 40 93 37-3 54-19 40-93" /><path d="m80 116 11 15-11 15-11-15 11-15Z" /></>
    : kind === "aretes" ? <><ellipse cx="52" cy="88" rx="21" ry="36" /><ellipse cx="52" cy="88" rx="17" ry="32" /><ellipse cx="109" cy="88" rx="21" ry="36" /><ellipse cx="109" cy="88" rx="17" ry="32" /><path d="M48 51v-8a4 4 0 0 1 8 0v8M105 51v-8a4 4 0 0 1 8 0v8" /></>
    : <><ellipse cx="80" cy="82" rx="57" ry="28" transform="rotate(-23 80 82)" /><ellipse cx="80" cy="82" rx="52" ry="23" transform="rotate(-23 80 82)" /><path d="m122 45 9 8-6 8-9-8 6-8Z" /></>}
  </svg>;
}
