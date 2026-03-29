import os

file_path = r'c:\Users\doggy\Documents\VELLIN - Codex\src\App.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Restore the giant missing block
# We find the end of addTodayReclaimed and the start of recommendations body.

start_marker = "    }));\\n  };"
end_marker = "    const recommendations = ["

# We also check for the "broken" state if markers fail
if start_marker.replace('\\n', '\n') in content and end_marker in content:
    idx1 = content.find(start_marker.replace('\\n', '\n')) + len(start_marker.replace('\\n', '\n'))
    idx2 = content.find(end_marker)
    
    missing_code = """

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
          showToast(`Session Complete! +${currentSeconds}s Reclaimed`);
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
    showToast(`Blocked ${app} -5 Focus Score`);
  };

  const handleToggleFocus = () => {
     setIsFocusing(prev => !prev);
  };

  const buildProPlan = () => {
    const topApps = Object.entries(blockedByApp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([app]) => app);
    const target = proPlanTargetMins;
    const focusBias = focusScore > 80 ? 'Maintain your rhythm with fewer check-ins.' : 'Start with shorter, tighter blocks.';
"""
    content = content[:idx1] + missing_code + content[idx2:]
    print("Core logic restored via gap filling.")
else:
    print("Markers not found!")

# 2. Update Dashboard props
content = content.replace(
    'completedTaskIds, setCompletedTaskIds, setTaskCompletions, streak, currentLevel, onOpenProPlan',
    'completedTaskIds, setCompletedTaskIds, setTaskCompletions, streak, maxStreak, currentLevel, onOpenProPlan'
)

# 3. Update Dashboard stat card
content = content.replace(
    '<div className="stat-label">Streak</div>',
    '<div className="stat-label">Best Streak</div>'
)
content = content.replace(
    '<div className="stat-value">{streak}d</div>',
    '<div className="stat-value">{maxStreak}d</div>'
)
content = content.replace(
    '<div className="stat-meta">Keep it alive</div>',
    '<div className="stat-meta">All-time record</div>'
)

# 4. Update App's render of Dashboard
content = content.replace(
    'streak={streak}',
    'streak={streak}\n              maxStreak={maxStreak}'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Repair complete.")
