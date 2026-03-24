"use client";
import { type Dictionary } from "../i18n/types";
import { useCallback, useEffect, useRef, useState } from "react";
import Papa, { ParseResult } from "papaparse";

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

export default function Examples({ dict }: ExamplesProps) {
  const [corpusData, setCorpusData] = useState<CorpusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeRowRef = useRef<HTMLTableRowElement>(null);

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

    const onTimeUpdate = () => syncHighlight();
    const onSeeked = () => syncHighlight();

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("seeked", onSeeked);
    syncHighlight();

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("seeked", onSeeked);
    };
  }, [corpusData, syncHighlight]);

  const seekToEntry = (entry: CorpusEntry) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = entry.startSeconds;
    void audio.play();
  };

  const scrollToCurrentLine = () => {
    activeRowRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (isLoading) {
    return (
      <section
        id="examples"
        className="relative overflow-hidden w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8 bg-base-100 pt-[100px]"
      >
        <div className="text-center">Loading corpus data...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        id="examples"
        className="relative overflow-hidden w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8 bg-base-100 pt-[100px]"
      >
        <div className="text-center text-red-500">{error}</div>
      </section>
    );
  }

  return (
    <section
      id="examples"
      className="relative overflow-hidden w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8 bg-base-100 pt-[100px]"
    >
      <div className="w-full overflow-x-auto">
        <div className="max-w-3xl mx-auto mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {dict.Examples.audioTitle}
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {dict.Examples.audioDescription}
              </span>
            </div>
            <audio
              ref={audioRef}
              className="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              src="https://alioss.aidimsum.com/%E4%B8%AA%E4%BA%BA%E5%9B%9E%E5%BF%86-%E4%BA%BA%E7%89%A9-%E6%88%91%E7%9A%84%E5%A7%90%E5%A7%90.wav"
              preload="metadata"
              controls
              controlsList="nodownload"
            />
            <div className="flex justify-end items-center gap-4">
              <button
                type="button"
                disabled={activeIndex < 0}
                onClick={scrollToCurrentLine}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-blue-600 dark:disabled:hover:text-blue-400"
              >
                {dict.Examples.scrollToCurrent}
              </button>
              <button
                type="button"
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  audio.currentTime = 0;
                  void audio.play();
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                {dict.Examples.replay}
              </button>
            </div>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800" />
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {corpusData.map((entry, index) => {
              const isActive = activeIndex === index;
              return (
                <tr
                  key={index}
                  ref={isActive ? activeRowRef : undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => seekToEntry(entry)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      seekToEntry(entry);
                    }
                  }}
                  className={[
                    "cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900",
                    isActive
                      ? "bg-primary/15 dark:bg-primary/25 ring-1 ring-inset ring-primary/40"
                      : index % 2 === 0
                        ? "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/80"
                        : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/80",
                  ].join(" ")}
                >
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      isActive
                        ? "text-gray-900 dark:text-gray-100 font-medium"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {entry.timestamp}
                    <br />
                    {entry.mandarinText}
                    <br />
                    {entry.tengxianText}
                    <br />
                    {entry.ipa}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
