import React, { useMemo, useState } from 'react';
import { runEngineSanityChecks } from '../engine';

export const SanityChecks: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  const checks = useMemo(() => {
    return runEngineSanityChecks();
  }, []);

  if (!isVisible) {
    return (
      <button 
        onClick={() => setIsVisible(true)}
        className="text-xs text-slate-400 hover:text-slate-600 underline"
      >
        Run internal sanity checks
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 bg-slate-100 rounded border border-slate-300">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold text-sm text-slate-700">Verification / Sanity Checks</h4>
        <button onClick={() => setIsVisible(false)} className="text-xs text-slate-500">Hide</button>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pb-1">Check</th>
            <th className="pb-1 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check, i) => (
            <tr key={i} className="border-t border-slate-200">
              <td className="py-2 pr-2">
                <div className="font-medium">{check.name}</div>
                <div className="text-slate-500 font-mono text-[10px]">{check.detail}</div>
              </td>
              <td className="py-2 text-right align-top">
                <span className={`px-1.5 py-0.5 rounded font-bold ${check.pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {check.pass ? 'PASS' : 'FAIL'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
