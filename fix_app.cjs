const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Restore the giant missing/corrupted block
const startMarker = "const updateStreak = () => {";
const endMarker = "const buildProPlan = () => {";

if (content.includes(startMarker) && content.includes(endMarker)) {
    const idx1 = content.indexOf(startMarker);
    const idx2 = content.indexOf(endMarker);
    
    const restoredBlock = `const updateStreak = () => {
    const today = new Date().toDateString();
    if (lastFocusDateRef.current === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    let newStreak = 1;
    if (lastFocusDateRef.current === yesterday.toDateString()) {
      newStreak = streakRef.current + 1;
    }

    setStreak(newStreak);
    setMaxStreak(prev => Math.max(prev, newStreak));
    setLastFocusDate(today);
  };

  const addTodayReclaimed = (seconds: number) => {
    const today = new Date().toDateString();
    setTodayReclaimed(prev => (lastReclaimedDate === today ? prev + seconds : seconds));
    setLastReclaimedDate(today);
    setFocusByDate(prev => ({
      ...prev,
      [today]: (prev[today] || 0) + seconds
    }));
  };

  // Show Toast Helper
  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Focus Timer Update logic
  useEffect(() => {
    let interval;
    if (isFocusing) {
      interval = setInterval(() => {
        setFocusSeconds(prev => {
          const next = prev + 1;
          focusSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      const currentSeconds = focusSecondsRef.current;
      if (currentSeconds > 0) {
        if (currentSeconds < 15) {
          setFocusScore(prev => Math.max(0, prev - 10));
          showToast("Session Abandoned -10 Focus Score");
        } else {
          setTotalSessions(prev => prev + 1);
          setTotalReclaimed(prev => prev + currentSeconds);
          addTodayReclaimed(currentSeconds);
          updateStreak();
          showToast(\`Session Complete! +\${currentSeconds}s Reclaimed\`);
        }
      }
      setFocusSeconds(0);
      focusSecondsRef.current = 0;
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isFocusing]); 

  // Handle Distraction Time
  const handleAppDistraction = (app: string, opts?: { simulate?: boolean }) => {
    setFocusScore(prev => Math.max(0, prev - 5));
    if (isFocusing) {
       setShowBlockScreen(true);
    }
    if (!opts?.simulate) {
      setBlockedCount(prev => prev + 1);
      setPhonePickups(prev => prev + 1);
      setBlockedByApp(prev => ({ ...prev, [app]: (prev[app] || 0) + 1 }));
    }
    if (opts?.simulate) {
      setTotalReclaimed(prev => prev + 15 * 60);
      addTodayReclaimed(15 * 60);
      showToast("Simulated +15m Reclaimed");
      return;
    }
    showToast(\`Blocked \${app} -5 Focus Score\`);
  };

  const handleToggleFocus = () => {
     setIsFocusing(prev => !prev);
  };

  `;
    content = content.slice(0, idx1) + restoredBlock + content.slice(idx2);
    console.log("Full core logic block restored.");
} else {
    console.log("Markers not found!");
}

// 2. Update Dashboard component props
content = content.replace(
    'completedTaskIds, setCompletedTaskIds, setTaskCompletions, streak, currentLevel, onOpenProPlan',
    'completedTaskIds, setCompletedTaskIds, setTaskCompletions, streak, maxStreak, currentLevel, onOpenProPlan'
);

// 3. Update Dashboard stat card to show maxStreak
content = content.replace(
    '<div className="stat-label">Streak</div>',
    '<div className="stat-label">Best Streak</div>'
);
content = content.replace(
    '<div className="stat-value">{streak}d</div>',
    '<div className="stat-value">{maxStreak}d</div>'
);
content = content.replace(
    '<div className="stat-meta">Keep it alive</div>',
    '<div className="stat-meta">All-time record</div>'
);

// 4. Update App's render of Dashboard
content = content.replace(
    'streak={streak}',
    `streak={streak}
              maxStreak={maxStreak}`
);

fs.writeFileSync(filePath, content);
console.log("Repair complete.");
