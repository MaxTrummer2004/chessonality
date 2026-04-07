# CSS File Split

This directory contains the split CSS files from the original `style.css` (6322 lines).

## File Mapping

| File | Lines | Content |
|------|-------|---------|
| base.css | 1-206 | CSS variables, color tokens, dark/light themes, base resets, header styling |
| layout.css | 207-476 | Container, PGN section, color picker, buttons, engine toggle, status bar, main grid, board, eval bar, navigation |
| panels.css | 477-722 | Right panel, tabs, panel boxes, progress bar, move list, move rows, highlights/badges, claude explanation |
| modals.css | 723-922 | Legal/privacy/TOS modals, confirm modal |
| pages.css | 923-1496 | Page transitions, landing page (page0), import page (page1), analyzing page, paywall, responsive overrides for these |
| profile.css | 1497-2024 | Profile page (page5) — identity, history, stats |
| analysis.css | 2025-2920 | Analysis page (pageMain) — personality card, game stats, board, eval bar overrides, AI coach panel, rich output cards |
| breakdown.css | 2921-3315 | Full game breakdown page (page7) |
| personality.css | 3316-3603 | Personality theming, header actions, decorative elements |
| insights.css | 3604-3957 | Insights page (page6), evolution charts, stat cards, strengths |
| coach.css | 3958-4830 | Coach practice plan, coach session, coach detail, quiz pages |
| onboarding.css | 4831-5086 | Onboarding overlay/walkthrough |
| responsive.css | 5087-5652 | All major responsive/media query blocks |
| paywall.css | 5653-5815 | Paywall styling |
| walkthrough.css | 5816-6322 | Interactive walkthrough/presentation mode |

## Total Lines: 6322

All 6322 lines from the original file have been preserved. Checksum verified.

To reconstruct the original file, concatenate in this order:
```bash
cat base.css layout.css panels.css modals.css pages.css profile.css analysis.css breakdown.css personality.css insights.css coach.css onboarding.css responsive.css paywall.css walkthrough.css > style.css
```
