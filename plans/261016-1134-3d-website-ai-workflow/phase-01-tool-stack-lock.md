# Phase 1 — Tool & stack lock (Step 1: pick the tool)
- Tool: Claude Code (agent đọc repo, multi-file) — đúng loại dự án.
- Chốt: three@0.186.1, Vite 8, React 19, WebGL renderer; ghi quyết định WebGPU/TSL.
- Nạp skill phiên bản hiện tại: `threejs-fundamentals`, `ak:threejs`, `threejs-errors-performance`, `3d-web-experience`.
- Chốt hậu kỳ: `postprocessing` (pmndrs) vs `EffectComposer` của three (không dùng `@react-three/postprocessing` vì không có R3F). Chốt công cụ rmbg chạy offline.
- State: thêm `zustand` (chưa cài) cho luồng camera/chuyển cảnh; đọc cấu hình chương từ bảng dữ liệu.
- Audit `src/journey/*` + `src/prototype/gris/*`: cái nào tái dùng.
- Validation: danh sách quyết định + skill dùng, user duyệt.
