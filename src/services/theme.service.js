import { profileService } from './profile.service';

export async function getUserTheme(userId) {
  try {
    const profile = await profileService.getById(userId);
    return profile?.theme || 'warm-brown';
  } catch (error) {
    console.error('Error fetching theme:', error);
    return 'warm-brown';
  }
}

export async function updateUserTheme(userId, theme) {
  try {
    await profileService.updateTheme(userId, theme);
  } catch (error) {
    console.error('Error updating theme:', error);
    throw error;
  }
}
