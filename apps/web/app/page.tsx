"use client";

import { useEffect, useState } from "react";

interface SheetData {
  headers: string[];
  data: Record<string, string>[];
}

export default function Home() {
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSheetNames();
  }, []);

  useEffect(() => {
    if (activeSheet) fetchData(activeSheet);
  }, [activeSheet]);

  async function fetchSheetNames() {
    try {
      const res = await fetch("/api/sheets?action=sheets");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSheetNames(json.sheets);
      if (json.sheets.length > 0) setActiveSheet(json.sheets[0]);
    } catch {
      setError("Sheet nomlarini yuklashda xatolik");
      setLoading(false);
    }
  }

  async function fetchData(sheet: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sheets?range=${encodeURIComponent(sheet)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSheetData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  const filteredData = sheetData?.data.filter((row) =>
    Object.values(row).some((val) =>
      val.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3 pl-16">
          <h1 className="text-[15px] font-semibold text-gray-900">
            Yangi Choy
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {sheetNames.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {sheetNames.filter((name) => name).map((name, i) => (
              <button
                key={`${name}-${i}`}
                onClick={() => setActiveSheet(name)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSheet === name
                    ? "bg-green-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {sheetData && sheetData.data.length > 0 && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="Qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-sm px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            <strong>Xatolik:</strong> {error}
            <p className="mt-1 text-xs text-red-500">
              .env.local faylidagi GOOGLE_SHEETS_ID va service account
              ma&apos;lumotlarini tekshiring.
            </p>
          </div>
        )}

        {!loading && !error && sheetData && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Jami:{" "}
                <strong className="text-gray-700">{filteredData?.length}</strong>{" "}
                ta yozuv
              </span>
              <button
                onClick={() => fetchData(activeSheet)}
                className="text-xs text-green-600 hover:underline"
              >
                Yangilash
              </button>
            </div>

            {filteredData && filteredData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-10">
                        #
                      </th>
                      {sheetData.headers.map((header) => (
                        <th
                          key={header}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {i + 1}
                        </td>
                        {sheetData.headers.map((header) => (
                          <td
                            key={header}
                            className="px-4 py-3 text-gray-700 whitespace-nowrap"
                          >
                            {row[header] || (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center text-gray-400 text-sm">
                Ma&apos;lumot topilmadi
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
