import { profileService } from './profile.service';

const SCRATCHPAD_KEY = 'studyspace_scratchpad';

export async function getScratchpad(userId) {
  try {
    return await profileService.getScratchpad(userId);
  } catch (error) {
    // Fallback to localStorage if database fails
    return getScratchpadLocal();
  }
}

export async function updateScratchpad(userId, content) {
  try {
    await profileService.updateScratchpad(userId, content);
  } catch (error) {
    // Fallback to localStorage if database fails
    updateScratchpadLocal(content);
  }
}

// Fallback localStorage methods for when database column isn't ready
export function getScratchpadLocal() {
  return localStorage.getItem(SCRATCHPAD_KEY) || '';
}

export function updateScratchpadLocal(content) {
  localStorage.setItem(SCRATCHPAD_KEY, content);
}
