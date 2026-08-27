"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupCommands, rankCommands, type Command } from "@/lib/search";
import { Kbd } from "@/components/ui/Badge";
import { IconSearch } from "@/components/ui/icons";

/** Single-letter jumps available after pressing `g`. */
const GOTO_KEYS: Record<string, string> = {
  d: "/",
  k: "/kyc",
  r: "/refunds",
  f: "/flags",
  a: "/audit",
};

export function CommandPalette({ commands }: { commands: Command[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingGoto = useRef(false);

  const results = useMemo(() => rankCommands(query, commands, 14), [query, commands]);
  const groups = useMemo(() => groupCommands(results), [results]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const run = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (open) {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
        return;
      }
      if (isTyping(event.target)) return;

      if (pendingGoto.current) {
        pendingGoto.current = false;
        const href = GOTO_KEYS[event.key.toLowerCase()];
        if (href) {
          event.preventDefault();
          router.push(href);
        }
        return;
      }
      if (event.key === "g") {
        pendingGoto.current = true;
        window.setTimeout(() => {
          pendingGoto.current = false;
        }, 1200);
      }
      if (event.key === "/") {
        event.preventDefault();
        // Prefer the page's own search box; fall back to the palette.
        const search = document.querySelector<HTMLInputElement>("[data-page-search]");
        if (search) search.focus();
        else setOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open, router]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="group flex h-8 w-56 items-center gap-2 rounded-lg border border-line bg-elevated px-2.5 text-xs text-faint transition-colors hover:border-line-strong hover:text-muted"
      >
        <IconSearch className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search cases, flags…</span>
        <Kbd>⌘K</Kbd>
      </button>
    );
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => (results.length === 0 ? 0 : (value + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (results.length === 0 ? 0 : (value - 1 + results.length) % results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[active];
      if (target) run(target.href);
    }
  }

  let index = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-scrim px-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onMouseDown={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line-strong bg-elevated shadow-overlay animate-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <IconSearch className="h-4 w-4 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search cases, flags and pages…"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-faint">No matches for “{query}”.</p>
          ) : (
            groups.map(([group, items]) => (
              <div key={group} className="mb-1 last:mb-0">
                <p className="px-4 py-1.5 text-2xs font-medium uppercase tracking-wider text-faint">
                  {group}
                </p>
                {items.map((item) => {
                  index += 1;
                  const isActive = index === active;
                  const itemIndex = index;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActive(itemIndex)}
                      onClick={() => run(item.href)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                        isActive ? "bg-panel-hover text-fg" : "text-muted"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint ? (
                        <span className="shrink-0 font-mono text-2xs text-faint">{item.hint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-2xs text-faint">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>g</Kbd> then <Kbd>k</Kbd> <Kbd>f</Kbd> <Kbd>a</Kbd> to jump
          </span>
        </div>
      </div>
    </div>
  );
}
