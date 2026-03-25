"use client";
import { type Dictionary } from "../i18n/types";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Papa, { ParseResult } from "papaparse";
import {
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  Pause,
  Play,
  RotateCcw,
  Search,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

interface CorpusEntry {
  mandarinText: string;
  tengxianText: string;
  ipa: string;
  timestamp: string;
  startSeconds: number;
}

interface ExamplesProps {
  dict: Dictionary;
}

interface CSVRow {
  普通话文本: string;
  藤县话文本: string;
  IPA: string;
  "起始时间(音频时间戳)": string;
}

/** 解析 [mm:ss.mmm] 或 [hh:mm:ss.mmm] 为秒 */
function parseTimestampToSeconds(raw: string): number {
  const inner = raw?.trim().replace(/^\[|\]$/g, "").trim() ?? "";
  const parts = inner.split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10) || 0;
    const sec = parseFloat(parts[1]) || 0;
    return m * 60 + sec;
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const sec = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + sec;
  }
  return 0;
}

/** 当前播放到 t 秒时应对应的行（最大 i 满足 startSeconds[i] <= t） */
function findActiveLineIndex(entries: CorpusEntry[], currentTime: number): number {
  if (entries.length === 0) return -1;
  let lo = 0;
  let hi = entries.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (entries[mid].startSeconds <= currentTime) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type SearchField = "mandarinText" | "tengxianText" | "ipa";

interface TextMatch {
  rowIndex: number;
  field: SearchField;
  start: number;
  end: number;
}

function collectSearchMatches(entries: CorpusEntry[], query: string): TextMatch[] {
  const q = query.trim();
  if (!q) return [];
  const qLower = q.toLowerCase();
  const matches: TextMatch[] = [];
  const fields: SearchField[] = ["mandarinText", "tengxianText", "ipa"];
  entries.forEach((entry, rowIndex) => {
    for (const field of fields) {
      const text = entry[field];
      const lower = text.toLowerCase();
      let pos = 0;
      while (pos < text.length) {
        const i = lower.indexOf(qLower, pos);
        if (i === -1) break;
        matches.push({ rowIndex, field, start: i, end: i + q.length });
        pos = i + q.length;
      }
    }
  });
  return matches;
}

function HighlightLine({
  text,
  field,
  rowIndex,
  query,
  active,
}: {
  text: string;
  field: SearchField;
  rowIndex: number;
  query: string;
  active: TextMatch | null;
}) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const qLower = q.toLowerCase();
  const lower = text.toLowerCase();
  const nodes: ReactNode[] = [];
  let pos = 0;
  let key = 0;
  while (pos < text.length) {
    const j = lower.indexOf(qLower, pos);
    if (j === -1) {
      nodes.push(<span key={key++}>{text.slice(pos)}</span>);
      break;
    }
    if (j > pos) nodes.push(<span key={key++}>{text.slice(pos, j)}</span>);
    const end = j + q.length;
    const isActive =
      active !== null &&
      active.rowIndex === rowIndex &&
      active.field === field &&
      active.start === j &&
      active.end === end;
    nodes.push(
      <mark
        key={key++}
        className={
          isActive
            ? "rounded-sm bg-primary/75 px-0.5 text-inherit ring-2 ring-primary ring-offset-1 ring-offset-transparent"
            : "rounded-sm bg-amber-400/45 px-0.5 text-inherit"
        }
      >
        {text.slice(j, end)}
      </mark>
    );
    pos = end;
  }
  return <>{nodes}</>;
}

export default function Examples({ dict }: ExamplesProps) {
  const [corpusData, setCorpusData] = useState<CorpusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeRowRef = useRef<HTMLTableRowElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [uiTime, setUiTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const isScrubbingRef = useRef(false);
  const volumeBeforeMute = useRef(1);
  const searchMatchRowRef = useRef<HTMLTableRowElement | null>(null);
  const playerCardRef = useRef<HTMLDivElement | null>(null);

  /** 与 Header h-16 / lg:h-20 及 sticky top-16 lg:top-20 一致 */
  const [stickyTopPx, setStickyTopPx] = useState(64);
  const [playerCardHeightPx, setPlayerCardHeightPx] = useState(280);
  const [isPlayerStuck, setIsPlayerStuck] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const searchMatches = useMemo(
    () => collectSearchMatches(corpusData, appliedSearchQuery),
    [corpusData, appliedSearchQuery]
  );

  const activeSearchOccurrence =
    searchMatches.length > 0 ? searchMatches[Math.min(currentMatchIndex, searchMatches.length - 1)] : null;

  useEffect(() => {
    if (searchMatches.length === 0) {
      setCurrentMatchIndex(0);
      return;
    }
    setCurrentMatchIndex((i) => Math.min(i, searchMatches.length - 1));
  }, [searchMatches.length]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const syncTop = () => setStickyTopPx(mq.matches ? 80 : 64);
    syncTop();
    mq.addEventListener("change", syncTop);
    return () => mq.removeEventListener("change", syncTop);
  }, []);

  useEffect(() => {
    if (isLoading || error) return;
    const el = playerCardRef.current;
    if (!el) return;
    const updateHeight = () => setPlayerCardHeightPx(el.offsetHeight);
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading, error, corpusData.length]);

  useEffect(() => {
    if (isLoading || error) return;
    const player = playerCardRef.current;
    if (!player) return;
    const checkStuck = () => {
      const top = player.getBoundingClientRect().top;
      setIsPlayerStuck(top <= stickyTopPx + 0.5);
    };
    checkStuck();
    window.addEventListener("scroll", checkStuck, { passive: true });
    window.addEventListener("resize", checkStuck);
    return () => {
      window.removeEventListener("scroll", checkStuck);
      window.removeEventListener("resize", checkStuck);
    };
  }, [isLoading, error, stickyTopPx, playerCardHeightPx]);

  const rowScrollMarginPx = useMemo(() => {
    const gap = 10;
    if (isPlayerStuck) {
      return stickyTopPx + playerCardHeightPx + gap;
    }
    return stickyTopPx + gap;
  }, [isPlayerStuck, stickyTopPx, playerCardHeightPx]);

  useEffect(() => {
    if (searchMatches.length === 0) return;
    searchMatchRowRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [currentMatchIndex, appliedSearchQuery, searchMatches.length]);

  const runSearch = () => {
    const q = searchInput.trim();
    setAppliedSearchQuery(q);
    setCurrentMatchIndex(0);
  };

  const clearSearch = () => {
    setSearchInput("");
    setAppliedSearchQuery("");
    setCurrentMatchIndex(0);
  };

  const goPrevMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((i) => (i <= 0 ? searchMatches.length - 1 : i - 1));
  };

  const goNextMatch = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((i) => (i >= searchMatches.length - 1 ? 0 : i + 1));
  };

  const syncHighlight = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || corpusData.length === 0) return;
    setActiveIndex(findActiveLineIndex(corpusData, audio.currentTime));
  }, [corpusData]);

  useEffect(() => {
    const loadCorpusData = async () => {
      try {
        const response = await fetch("/corpus_demo.csv", { cache: "no-store" });
        const csvText = await response.text();
        Papa.parse<CSVRow>(csvText, {
          header: true,
          complete: (results: ParseResult<CSVRow>) => {
            const parsedData: CorpusEntry[] = results.data
              .filter(
                (row) =>
                  (row["普通话文本"]?.trim() ?? "") !== "" ||
                  (row["藤县话文本"]?.trim() ?? "") !== ""
              )
              .map((row) => ({
                mandarinText: row["普通话文本"] ?? "",
                tengxianText: row["藤县话文本"] ?? "",
                ipa: row["IPA"] ?? "",
                timestamp: row["起始时间(音频时间戳)"] ?? "",
                startSeconds: parseTimestampToSeconds(
                  row["起始时间(音频时间戳)"] ?? ""
                ),
              }));

            setCorpusData(parsedData);
            setIsLoading(false);
          },
          error: (parseError: Error) => {
            console.error("CSV parsing error:", parseError);
            setError("Failed to parse CSV data");
            setIsLoading(false);
          },
        });
      } catch (loadError) {
        console.error("CSV loading error:", loadError);
        setError("Failed to load corpus data");
        setIsLoading(false);
      }
    };

    loadCorpusData();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || corpusData.length === 0) return;

    const onTimeUpdate = () => {
      if (!isScrubbingRef.current) setUiTime(audio.currentTime);
      syncHighlight();
    };
    const onSeeked = () => {
      setUiTime(audio.currentTime);
      syncHighlight();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("seeked", onSeeked);
    syncHighlight();
    setUiTime(audio.currentTime);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("seeked", onSeeked);
    };
  }, [corpusData, syncHighlight]);

  useEffect(() => {
    if (isLoading || error) return;
    const audio = audioRef.current;
    if (!audio) return;

    const refreshMeta = () => {
      const d = audio.duration;
      if (Number.isFinite(d)) setDuration(d);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("loadedmetadata", refreshMeta);
    audio.addEventListener("durationchange", refreshMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    refreshMeta();

    return () => {
      audio.removeEventListener("loadedmetadata", refreshMeta);
      audio.removeEventListener("durationchange", refreshMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [isLoading, error]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const seekToEntry = (entry: CorpusEntry) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = entry.startSeconds;
    setUiTime(entry.startSeconds);
    void audio.play();
  };

  const scrollToCurrentLine = () => {
    activeRowRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const displayTime = isScrubbing ? scrubTime : uiTime;
  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  const applyProgressFromClientX = (clientX: number, commit: boolean) => {
    const bar = progressBarRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !Number.isFinite(duration) || duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const t = ratio * duration;
    setScrubTime(t);
    if (commit) {
      audio.currentTime = t;
      setUiTime(t);
    }
  };

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !Number.isFinite(duration) || duration <= 0) return;
    bar.setPointerCapture(e.pointerId);
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    applyProgressFromClientX(e.clientX, false);
  };

  const handleProgressPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    applyProgressFromClientX(e.clientX, false);
  };

  const handleProgressPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    const bar = progressBarRef.current;
    if (bar?.hasPointerCapture(e.pointerId)) {
      bar.releasePointerCapture(e.pointerId);
    }
    applyProgressFromClientX(e.clientX, true);
    isScrubbingRef.current = false;
    setIsScrubbing(false);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
  };

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      const v = volumeBeforeMute.current > 0 ? volumeBeforeMute.current : 0.8;
      setVolume(v);
    } else {
      volumeBeforeMute.current = volume;
      setMuted(true);
    }
  };

  if (isLoading) {
    return (
      <section
        id="examples"
        className="relative w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8 bg-base-100 pt-[100px]"
      >
        <div className="text-center">Loading corpus data...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        id="examples"
        className="relative w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8 bg-base-100 pt-[100px]"
      >
        <div className="text-center text-red-500">{error}</div>
      </section>
    );
  }

  return (
    <section
      id="examples"
      className="relative w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8 bg-base-100 pt-[100px]"
    >
      <div className="w-full max-w-full">
        <div
          ref={playerCardRef}
          className="sticky top-16 lg:top-20 z-[100] mb-8 w-full rounded-2xl border border-white/25 bg-zinc-900/55 p-4 shadow-[0_10px_36px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-5"
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
              <h3 className="text-lg font-semibold text-zinc-50 drop-shadow-sm">
                {dict.Examples.audioTitle}
              </h3>
              <span className="text-sm text-zinc-200/95 sm:text-right sm:max-w-[55%]">
                {dict.Examples.audioDescription}
              </span>
            </div>

            <audio
              ref={audioRef}
              className="hidden"
              preload="metadata"
              src="https://alioss.aidimsum.com/%E4%B8%AA%E4%BA%BA%E5%9B%9E%E5%BF%86-%E4%BA%BA%E7%89%A9-%E6%88%91%E7%9A%84%E5%A7%90%E5%A7%90.wav"
            />

            <div
              className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-gradient-to-br from-zinc-900/70 via-zinc-800/55 to-zinc-900/65 px-3 py-3 text-white shadow-inner backdrop-blur-xl ring-1 ring-white/10 sm:px-4 sm:py-3.5"
              role="region"
              aria-label={dict.Examples.audioTitle}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="btn btn-circle btn-sm sm:btn-md shrink-0 border-0 bg-primary text-white hover:bg-primary/90"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? (
                    <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" />
                  ) : (
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 text-white" fill="currentColor" />
                  )}
                </button>

                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <div
                    ref={progressBarRef}
                    className="group relative h-2.5 cursor-pointer rounded-full bg-white/12 touch-none"
                    onPointerDown={handleProgressPointerDown}
                    onPointerMove={handleProgressPointerMove}
                    onPointerUp={handleProgressPointerUp}
                    onPointerCancel={handleProgressPointerUp}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/80"
                      style={{ width: `${progressPct}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-md opacity-90 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 pointer-events-none"
                      style={{ left: `calc(${progressPct}% - 8px)` }}
                    />
                  </div>
                  <div className="flex justify-between font-mono text-[11px] sm:text-xs tabular-nums text-zinc-100">
                    <span>{formatPlaybackTime(displayTime)}</span>
                    <span>{formatPlaybackTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="btn btn-ghost btn-square btn-sm text-white/90 hover:bg-white/12"
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={muted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      setMuted(v === 0);
                    }}
                    className="hidden w-0 sm:block sm:w-20 h-1.5 cursor-pointer appearance-none rounded-full bg-white/22 accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-0.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
                    <input
                      type="text"
                      role="searchbox"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") runSearch();
                        if (e.key === "Escape") clearSearch();
                      }}
                      placeholder={dict.Examples.searchPlaceholder}
                      className={`w-full rounded-lg border border-white/25 bg-white/10 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/50 ${
                        appliedSearchQuery || searchInput ? "pl-3 pr-9" : "px-3"
                      }`}
                      aria-label={dict.Examples.searchPlaceholder}
                    />
                    {(appliedSearchQuery || searchInput) ? (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-300 hover:bg-white/15 hover:text-zinc-100"
                        aria-label={dict.Examples.searchClear}
                        title={dict.Examples.searchClear}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={runSearch}
                    className="btn btn-sm shrink-0 gap-1 border-0 bg-white/18 text-zinc-100 hover:bg-white/28"
                  >
                    <Search className="h-4 w-4" aria-hidden />
                    {dict.Examples.searchButton}
                  </button>
                  {appliedSearchQuery ? (
                    <span className="text-xs tabular-nums text-zinc-200/95">
                      {searchMatches.length === 0
                        ? dict.Examples.searchNoResults
                        : `${currentMatchIndex + 1}/${searchMatches.length}`}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={searchMatches.length === 0}
                      onClick={goPrevMatch}
                      className="btn btn-square btn-xs shrink-0 border border-white/22 bg-white/12 text-zinc-100 hover:bg-white/22 disabled:opacity-30"
                      aria-label={dict.Examples.prevMatch}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={searchMatches.length === 0}
                      onClick={goNextMatch}
                      className="btn btn-square btn-xs shrink-0 border border-white/22 bg-white/12 text-zinc-100 hover:bg-white/22 disabled:opacity-30"
                      aria-label={dict.Examples.nextMatch}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 justify-end items-center gap-2">
                <button
                  type="button"
                  disabled={activeIndex < 0}
                  onClick={scrollToCurrentLine}
                  className="btn btn-square btn-sm shrink-0 border-0 bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={dict.Examples.scrollToCurrent}
                >
                  <LocateFixed className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    audio.currentTime = 0;
                    setUiTime(0);
                    void audio.play();
                  }}
                  className="btn btn-square btn-sm shrink-0 border-0 bg-white/10 text-white hover:bg-white/20"
                  aria-label={dict.Examples.replay}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full overflow-x-auto rounded-xl border border-zinc-700/50">
          <table className="w-full min-w-full divide-y divide-zinc-700/60">
            <thead className="bg-zinc-900/70" />
            <tbody className="divide-y divide-zinc-700/60 bg-zinc-900/40">
              {corpusData.map((entry, index) => {
                const isActive = activeIndex === index;
                return (
                  <tr
                    key={index}
                    ref={(el) => {
                      if (isActive) activeRowRef.current = el;
                      const mr =
                        searchMatches.length > 0
                          ? searchMatches[
                              Math.min(currentMatchIndex, searchMatches.length - 1)
                            ]?.rowIndex
                          : -1;
                      if (index === mr) {
                        searchMatchRowRef.current = el;
                      } else if (el && searchMatchRowRef.current === el) {
                        searchMatchRowRef.current = null;
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => seekToEntry(entry)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        seekToEntry(entry);
                      }
                    }}
                    style={{ scrollMarginTop: rowScrollMarginPx }}
                    className={[
                      "cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                      isActive
                        ? "bg-primary/30 ring-1 ring-inset ring-primary/50"
                        : index % 2 === 0
                          ? "bg-zinc-800/45 hover:bg-zinc-700/55"
                          : "bg-zinc-800/70 hover:bg-zinc-700/55",
                    ].join(" ")}
                  >
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm ${
                        isActive
                          ? "font-medium text-zinc-50"
                          : "text-zinc-200/95"
                      }`}
                    >
                      {entry.timestamp}
                      <br />
                      <HighlightLine
                        text={entry.mandarinText}
                        field="mandarinText"
                        rowIndex={index}
                        query={appliedSearchQuery}
                        active={activeSearchOccurrence}
                      />
                      <br />
                      <HighlightLine
                        text={entry.tengxianText}
                        field="tengxianText"
                        rowIndex={index}
                        query={appliedSearchQuery}
                        active={activeSearchOccurrence}
                      />
                      <br />
                      <HighlightLine
                        text={entry.ipa}
                        field="ipa"
                        rowIndex={index}
                        query={appliedSearchQuery}
                        active={activeSearchOccurrence}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
