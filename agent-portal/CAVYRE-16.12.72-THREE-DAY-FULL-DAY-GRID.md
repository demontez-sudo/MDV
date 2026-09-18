# CAVYRE 16.12.72 — Three-Day Full-Day Grid

The 3-Day view was scrollable in 16.12.71, but a legacy absolute-positioned
calendar surface stopped painting the day columns after the early afternoon.

16.12.72 makes the timeline itself the permanent 8 AM–8 PM visual authority.

- Full 780px / 13-hour runway is always painted.
- Hour rules continue from 8 AM through 8 PM.
- All three day columns are forced to the full timeline height.
- Time labels remain above the calendar surfaces.
- Legend is moved after the timeline instead of sticking over the schedule.
- 3-Day vertical scrolling from 16.12.71 remains.
- Approved Calendar design from 16.12.70 remains.
- No event/API/drag-drop/geometry/model-schedule logic changed.
