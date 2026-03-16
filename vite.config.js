import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When building in GitHub Actions, GITHUB_REPOSITORY = "user/repo-name"
// We extract the repo name to use as base path for GitHub Pages.
const repoName = process.env.GITHUB_REPOSITORY
  ? '/' + process.env.GITHUB_REPOSITORY.split('/')[1] + '/'
  : '/';

export default defineConfig({
  plugins: [react()],
  base: repoName,
})
