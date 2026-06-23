import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // node:sqlite 是 Node 22.5+ 实验性内置模块,显式 external 以保留 node: 前缀
  // (esbuild 默认会对认识的 builtin 去 node: 前缀,但 bare "sqlite" 在 Node 下不可用)
  external: ['node:sqlite'],
});
