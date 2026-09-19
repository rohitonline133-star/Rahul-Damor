import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, Clock, RefreshCw, Play, ShieldCheck } from 'lucide-react';
import { TestReport, TestItem } from '../../types';

interface TestSuiteModalProps {
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TestReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tests/run', { method: 'POST' });
      if (!res.ok) throw new Error('Test suite execution failed');
      const data: TestReport = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Error running test suite');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 leading-tight">
                GB Automated Quality & Verification Suite
              </h3>
              <p className="text-[11px] text-slate-500">
                End-to-End Real Backend Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Overview Bar */}
        {report && (
          <div className="grid grid-cols-4 gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 text-center">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
              <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                {report.total}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 shadow-sm border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                Passed
              </span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {report.passed}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 shadow-sm border border-red-200/60 dark:border-red-800/60">
              <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 block">
                Failed
              </span>
              <span className="text-base font-extrabold text-red-600 dark:text-red-400">
                {report.failed}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Not Tested
              </span>
              <span className="text-base font-extrabold text-slate-500">{report.notTested}</span>
            </div>
          </div>
        )}

        {/* Tests List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-2.5 text-xs">
          {loading && (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-emerald-500" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                Running real API suite...
              </p>
              <p className="text-[11px]">Testing auth, encryption, SSE routing, media, and state</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {!loading &&
            report?.tests.map((test: TestItem, index: number) => {
              const isPass = test.status === 'PASS';
              const isFail = test.status === 'FAIL';

              return (
                <div
                  key={index}
                  className={`p-3 rounded-2xl border transition ${
                    isPass
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60'
                      : isFail
                      ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200/80 dark:border-red-800/60'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {test.name}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPass ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white font-extrabold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 stroke-[3]" /> PASS
                        </span>
                      ) : isFail ? (
                        <span className="px-2 py-0.5 rounded-md bg-red-600 text-white font-extrabold text-[10px] flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> FAIL
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-400 text-white font-extrabold text-[10px]">
                          NOT TESTED
                        </span>
                      )}

                      {test.durationMs !== undefined && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {test.durationMs}ms
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {test.details}
                  </p>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            GB Engine 2.4.0 • Tests live
          </span>

          <div className="flex gap-2">
            <button
              onClick={runTests}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Rerun All Tests
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
