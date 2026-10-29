import {defineConfig} from 'vitest/config'
export default defineConfig({test:{include:['experiments/gripper3d/research-paths.research.ts'],testTimeout:3_600_000}})
