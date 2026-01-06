import React, { useState, useMemo, useEffect } from 'react';
import { Scenario, analyzeScenario, createDefaultScenario, Result } from './engine';
import { ScenarioForm } from './components/ScenarioForm';
import { ResultsPanel } from './components/ResultsPanel';
import { OperatingPointChart } from './components/OperatingPointChart';
import { SanityChecks } from './components/SanityChecks';

const App: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([createDefaultScenario()]);
  const [activeId, setActiveId] = useState<string>(scenarios[0].id);

  const activeScenario = useMemo(() => 
    scenarios.find(s => s.id === activeId) || scenarios[0], 
  [scenarios, activeId]);

  const result: Result = useMemo(() => 
    analyzeScenario(activeScenario), 
  [activeScenario]);

  // Handlers
  const handleUpdateScenario = (updated: Scenario) => {
    setScenarios(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handleAddScenario = () => {
    const newS = createDefaultScenario();
    newS.id = `scenario-${Date.now()}`;
    newS.name = `New Scenario ${scenarios.length + 1}`;
    setScenarios([...scenarios, newS]);
    setActiveId(newS.id);
  };

  const handleDuplicate = () => {
    const copy = JSON.parse(JSON.stringify(activeScenario)) as Scenario;
    copy.id = `scenario-${Date.now()}`;
    copy.name = `${activeScenario.name} (Copy)`;
    setScenarios([...scenarios, copy]);
    setActiveId(copy.id);
  };

  const handleDelete = () => {
    if (scenarios.length === 1) return alert("Cannot delete the last scenario.");
    if (confirm(`Delete ${activeScenario.name}?`)) {
      const remaining = scenarios.filter(s => s.id !== activeId);
      setScenarios(remaining);
      setActiveId(remaining[remaining.length - 1].id);
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(activeScenario, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json).then(() => alert("Scenario JSON copied to clipboard!"));
    } else {
      alert("Clipboard not available.\n" + json);
    }
  };

  const handleImport = () => {
    const str = prompt("Paste Scenario JSON:");
    if (!str) return;
    try {
      const parsed = JSON.parse(str);
      // Minimal schema check
      if (!parsed.tank || !parsed.inlet) throw new Error("Invalid schema");
      parsed.id = `import-${Date.now()}`;
      parsed.name = `Imported: ${parsed.name}`;
      setScenarios([...scenarios, parsed]);
      setActiveId(parsed.id);
    } catch (e) {
      alert("Failed to import: Invalid JSON or Schema");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">T</div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Tank Mixing <span className="text-blue-600">Design Tool</span></h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="px-3 py-1 text-sm border rounded hover:bg-slate-50">Export</button>
            <button onClick={handleImport} className="px-3 py-1 text-sm border rounded hover:bg-slate-50">Import</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* Left Column: List & Form */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Scenario Selector */}
            <div className="card flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase">Scenario</label>
                <div className="flex gap-1">
                  <button onClick={handleAddScenario} className="text-xs text-blue-600 hover:underline">Add</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={handleDuplicate} className="text-xs text-blue-600 hover:underline">Duplicate</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={handleDelete} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
              <select 
                className="input-field"
                value={activeId}
                onChange={(e) => setActiveId(e.target.value)}
              >
                {scenarios.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input 
                type="text" 
                className="text-sm border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1"
                value={activeScenario.name}
                onChange={(e) => handleUpdateScenario({...activeScenario, name: e.target.value})}
              />
            </div>

            {/* Input Form */}
            <div className="flex-1 min-h-[400px]">
              <ScenarioForm scenario={activeScenario} onUpdate={handleUpdateScenario} />
            </div>

            {/* Sanity Checks */}
            <SanityChecks />
          </div>

          {/* Right Column: Dashboard */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <ResultsPanel result={result} />
            <OperatingPointChart currentScenario={activeScenario} currentResult={result} allScenarios={scenarios} />
            
            {/* Compare Mini-Table */}
            <div className="card">
              <h3 className="section-header text-sm">Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-500 bg-slate-50">
                    <tr>
                      <th className="p-2">Name</th>
                      <th className="p-2">Overall</th>
                      <th className="p-2">Vjet (m/s)</th>
                      <th className="p-2">Ri</th>
                      <th className="p-2">TOR (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map(s => {
                      const r = analyzeScenario(s);
                      return (
                        <tr key={s.id} className={s.id === activeId ? "bg-blue-50" : "border-t border-slate-100"}>
                          <td className="p-2 font-medium">{s.name}</td>
                          <td className="p-2 font-bold" style={{
                            color: r.overallStatus === 'PASS' ? '#16a34a' : r.overallStatus === 'WARN' ? '#ea580c' : '#dc2626'
                          }}>{r.overallStatus}</td>
                          <td className="p-2 font-mono">{r.metrics.inletVelocity_m_s.toFixed(2)}</td>
                          <td className="p-2 font-mono">{r.metrics.richardsonNumber > 100 ? '>100' : r.metrics.richardsonNumber.toFixed(2)}</td>
                          <td className="p-2 font-mono">{(r.metrics.turnoverRatio * 100).toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
