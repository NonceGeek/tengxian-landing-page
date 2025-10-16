"use client";
import { FadeInUp } from "./ScrollReveal";
import { type Dictionary } from "../i18n/types";
import { useEffect, useState } from "react";
import Papa, { ParseResult } from "papaparse";

interface CorpusEntry {
  mandarinText: string;
  tengxianText: string;
  ipa: string;
  timestamp: string;
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

export default function Examples({ dict }: ExamplesProps) {
  const [corpusData, setCorpusData] = useState<CorpusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCorpusData = async () => {
      try {
        const response = await fetch("/corpus_demo.csv", { cache: "no-store" });
        const csvText = await response.text();
        console.log(csvText);
        Papa.parse<CSVRow>(csvText, {
          header: true,
          complete: (results: ParseResult<CSVRow>) => {
            const parsedData: CorpusEntry[] = results.data.map(
              (row) => (
                console.log(row),
                {
                  mandarinText: row["普通话文本"],
                  tengxianText: row["藤县话文本"],
                  ipa: row["IPA"],
                  timestamp: row["起始时间(音频时间戳)"],
                }
              )
            );

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

  if (isLoading) {
    return (
      <FadeInUp>
        <section
          id="examples"
          className="relative overflow-hidden w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8 bg-base-100"
        >
          <div className="text-center">Loading corpus data...</div>
        </section>
      </FadeInUp>
    );
  }

  if (error) {
    return (
      <FadeInUp>
        <section
          id="examples"
          className="relative overflow-hidden w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8 bg-base-100"
        >
          <div className="text-center text-red-500">{error}</div>
        </section>
      </FadeInUp>
    );
  }

  return (
    <FadeInUp>
        <section
          id="examples"
          className="relative overflow-hidden w-full mx-auto min-h-[60vh] sm:min-h-[70vh] md:min-h-[80vh] flex items-center justify-center pb-20 sm:pb-28 md:pb-36 lg:pb-40 px-4 sm:px-6 md:px-8 bg-base-100"
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
                className="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                src="/demo.m4a"
                preload="metadata"
                controls
                controlsList="nodownload"
                onPlay={() => console.log("Audio playback started")}
                onPause={() => console.log("Audio playback paused")}
                onEnded={() => console.log("Audio playback completed")}
              />
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const audio = document.querySelector("audio");
                    if (audio) {
                      audio.currentTime = 0;
                      audio.play();
                    }
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  {dict.Examples.replay}
                </button>
              </div>
            </div>
          </div>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800"></thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {corpusData.map((entry, index) => (
                <tr
                  key={index}
                  className={
                    index % 2 === 0
                      ? "bg-white dark:bg-gray-900"
                      : "bg-gray-50 dark:bg-gray-800"
                  }
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {entry.timestamp}
                    <br></br>
                    {entry.mandarinText}
                    <br></br>
                    {entry.tengxianText}
                    <br></br>
                    {entry.ipa}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </FadeInUp>
  );
}
