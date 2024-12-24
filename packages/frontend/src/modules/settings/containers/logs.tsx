import { useSocket } from '@/lib/hooks/use-socket';
import { Suspense, lazy, useRef, useState } from 'react';

const LogsTerminal = lazy(() => import('@/components/logs-terminal/logs-terminal').then((module) => ({ default: module.LogsTerminal })));

export const LogsContainer = () => {
  let nextId = 0;
  const [logs, setLogs] = useState<{ id: number; text: string }[]>([]);
  const maxLines = useRef(300);

  useSocket({
    selector: { type: 'runtipi-logs', event: 'newLogs' },
    onCleanup: () => setLogs([]),
    emitOnConnect: { type: 'runtipi-logs-init', event: 'initLogs', data: { maxLines: maxLines.current } },
    emitOnDisconnect: { type: 'runtipi-logs', event: 'stopLogs', data: {} },
    onEvent: (_, data) => {
      setLogs((prevLogs) => {
        if (!data.lines) {
          return prevLogs;
        }
        const newLogs = [...prevLogs, ...data.lines.map((line) => ({ id: nextId++, text: line.trim() }))];
        if (newLogs.length > maxLines.current) {
          return newLogs.slice(newLogs.length - maxLines.current);
        }
        return newLogs;
      });
    },
  });

  const updateMaxLines = (lines: number) => {
    const linesToKeep = Math.max(1, lines);
    maxLines.current = linesToKeep;
    setLogs(logs.slice(logs.length - linesToKeep));
  };

  return (
    <Suspense>
      <LogsTerminal logs={logs} maxLines={maxLines.current} onMaxLinesChange={updateMaxLines} />
    </Suspense>
  );
};
