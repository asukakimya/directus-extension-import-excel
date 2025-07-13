export function resolveLocale(locale) {
  if (locale) {
    if (locale.includes('-')) {
      return locale.split('-')[0].toLowerCase();
    }
    return locale.toLowerCase();
  }
  return 'en';
}
