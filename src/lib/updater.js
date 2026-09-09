export const APP_VERSION = '1.0.1'

/**
 * Compares two semver strings (e.g. "v1.0.2" vs "1.0.1")
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal
 */
export function compareVersions(v1, v2) {
  const parse = (v) => (v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  const [maj1 = 0, min1 = 0, pat1 = 0] = parse(v1)
  const [maj2 = 0, min2 = 0, pat2 = 0] = parse(v2)
  if (maj1 !== maj2) return maj1 - maj2
  if (min1 !== min2) return min1 - min2
  return pat1 - pat2
}

/**
 * Queries GitHub Releases API for the latest published AetherFlow release
 */
export async function checkForUpdate() {
  try {
    const response = await fetch('https://api.github.com/repos/yashpreeto7/aetherflow/releases/latest', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      }
    })
    if (!response.ok) {
      if (response.status === 404) {
        return { hasUpdate: false, message: 'You are running the latest version.' }
      }
      throw new Error(`GitHub API returned status ${response.status}`)
    }
    const data = await response.json()
    const latestTag = data.tag_name || ''
    const isNewer = compareVersions(latestTag, APP_VERSION) > 0

    const setupAsset = data.assets?.find(a => a.name?.endsWith('.exe'))
    const zipAsset = data.assets?.find(a => a.name?.endsWith('.zip'))
    const downloadUrl = setupAsset?.browser_download_url || zipAsset?.browser_download_url || data.html_url

    return {
      hasUpdate: isNewer,
      currentVersion: APP_VERSION,
      latestVersion: latestTag.replace(/^v/, ''),
      latestTag,
      releaseName: data.name || latestTag,
      releaseNotes: data.body || '',
      publishedAt: data.published_at,
      releaseUrl: data.html_url,
      downloadUrl,
      assetName: setupAsset?.name || zipAsset?.name || 'AetherFlow Installer',
    }
  } catch (err) {
    console.warn('[AetherFlow Updater] Failed to check for updates:', err)
    return { hasUpdate: false, error: err.message }
  }
}

/**
 * Opens the release or download link safely
 */
export async function openReleaseUrl(url) {
  if (!url) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    // If Tauri command exists or invoke via system command
    window.open(url, '_blank')
  } catch {
    window.open(url, '_blank')
  }
}
