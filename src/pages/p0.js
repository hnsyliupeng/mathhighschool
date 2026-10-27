/* =============================================================
   封面 · 可旋转的正方体 + 球 + 棱锥组合
   ============================================================= */
(function () {
  'use strict';
  const E = window.Ink3D, G = window.Geo;

  window.PAGES.push({
    id: 'cover',
    kind: 'cover',
    short: '封面',
    title: '高中立体几何 3D 互动解读',
    chapter: '封面',
    camera: { zoom: 1.0, pitch: 0.3, yaw: -0.55 },
    autoSpin: 0.09,

    scene(t, ctx) {
      const st = ctx.studio;
      const items = [];
      // 正方体（左）
      items.push(G.shift(G.box({ st, w: 1.75, h: 1.75, d: 1.75, cx: 0, cy: 0, cz: 0, key: 'cube' }).items, [-1.15, -0.9, 0]));
      // 正四棱锥（右后）
      items.push(G.shift(G.polySolid({
        st, n: 4, r: 0.92, h: 1.9, y0: 0, rot: Math.PI / 4,
        kind: 'pyramid', apexName: 'P', key: 'pyr', tint: G.tint(st, 0.06),
      }).items, [1.25, -0.9, -0.35]));
      // 球（前）
      items.push(G.sphere({ c: [0.18, -0.3, 1.15], r: 0.55, key: 'ball', color: G.tint(st, 0.1) }));
      // 圆台（左前，小）
      items.push(G.shift(G.polySolid({
        st, n: 4, r: 0.34, rTop: 0.18, h: 0.7, y0: 0, rot: Math.PI / 4,
        kind: 'frustum', key: 'fr', tint: G.tint(st, 0.02),
      }).items, [-1.95, -0.9, 1.2]));
      // 手绘地面线
      const ground = [];
      for (let i = -3.2; i <= 3.2; i += 0.22) {
        ground.push([i, -0.94, 2.0 + Math.sin(i * 2.4) * 0.02]);
      }
      items.push(E.poly(ground, { color: G.ink(st), sw: 0.8, alpha: 0.16 }));
      return { items, fit: 1.0 };
    },

    init(ctx) {
      ctx.studio.offset = [0, 0.05, 0];
    },
  });
})();
