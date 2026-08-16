/**
 * Utility to resolve and maintain human driver names across the entire platform
 * Prevents driver names from being displayed as raw IDs (UIDs, email prefixes, or tracker IDs)
 */

export function cleanName(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a string looks like a system ID, Firebase UID, or technical prefix
 * (e.g. 'mot-001', 'tx-02', '2hxxqzehmg6kvmur3bxyou', 'driver_123', 'anon-driver', or empty)
 */
export function isIdLike(name: string | undefined | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (!trimmed) return true;

  // If it contains space and at least 2 words with standard letters, it's likely a real human name
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && !trimmed.includes('@') && !trimmed.includes('-') && trimmed.length > 5) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  
  // Technical prefixes or placeholders
  if (
    /^mot[-_]?\d+/i.test(trimmed) ||
    /^tx[-_]?\d+/i.test(trimmed) ||
    /^driver[-_]?\d*/i.test(trimmed) ||
    /^user[-_]?\d*/i.test(trimmed) ||
    lower.startsWith('mot-') ||
    lower.startsWith('tx-') ||
    lower.startsWith('driver_') ||
    lower.startsWith('driver-') ||
    lower.startsWith('user_') ||
    lower.startsWith('anon') ||
    lower === 'motorista' ||
    lower === 'driver' ||
    lower === 'desconhecido' ||
    lower === 'unknown' ||
    lower === 'utilizador' ||
    lower.includes('@') ||
    /^[a-zA-Z0-9_-]{20,}$/.test(trimmed) // Firebase auto-generated UID pattern
  ) {
    return true;
  }

  // If single word that is all digits or looks like a shortcode
  if (/^[0-9]+$/.test(trimmed) || /^[a-z0-9]{1,4}$/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Resolves the full human driver name given any identifier or existing string,
 * cross-referencing Master Drivers list, Active Fleet Vehicles, and Users.
 */
export function resolveDriverName(
  identifierOrName: string | undefined | null,
  driversMaster: any[] = [],
  vehicles: any[] = [],
  users: any[] = []
): string {
  if (!identifierOrName) return 'Motorista';
  const target = String(identifierOrName).trim();

  // If it's already a clean multi-word human name and not ID-like, check if it exists in driversMaster
  if (!isIdLike(target)) {
    const directMatch = driversMaster.find(d => 
      cleanName(d.name) === cleanName(target) ||
      (d.name && d.name.toLowerCase() === target.toLowerCase())
    );
    if (directMatch?.name) return directMatch.name;
    return target; // Return the valid human name directly
  }

  const cleanTarget = cleanName(target);
  const targetLower = target.toLowerCase();

  // 1. Search in Drivers Master (Official Master Driver Registry)
  const masterMatch = driversMaster.find(d => {
    if (!d) return false;
    if (d.id === target || d.uid === target || d.driverId === target) return true;
    if (d.phone && (d.phone === target || d.phone.replace(/\D/g, '') === target.replace(/\D/g, ''))) return true;
    if (d.licenseNumber && d.licenseNumber.toLowerCase() === targetLower) return true;
    if (d.email && d.email.toLowerCase() === targetLower) return true;
    if (d.prefix && d.prefix.toLowerCase() === targetLower) return true;
    if (d.name && cleanName(d.name) === cleanTarget) return true;
    return false;
  });

  if (masterMatch?.name && !isIdLike(masterMatch.name)) {
    return masterMatch.name;
  }

  // 2. Search in Active Fleet Vehicles (drivers collection)
  const vehicleMatch = vehicles.find(v => {
    if (!v) return false;
    if (v.id === target || v.driverId === target || v.trackerId === target) return true;
    if (v.prefix && v.prefix.toLowerCase() === targetLower) return true;
    if (v.plate && v.plate.toLowerCase() === targetLower) return true;
    if (v.phone && (v.phone === target || v.phone.replace(/\D/g, '') === target.replace(/\D/g, ''))) return true;
    if (v.name && cleanName(v.name) === cleanTarget) return true;
    return false;
  });

  if (vehicleMatch?.name && !isIdLike(vehicleMatch.name)) {
    return vehicleMatch.name;
  }

  // 3. Search in System Users collection
  const userMatch = users.find(u => {
    if (!u) return false;
    if (u.uid === target || u.id === target) return true;
    if (u.email && u.email.toLowerCase() === targetLower) return true;
    if (u.phone && u.phone === target) return true;
    if (u.name && cleanName(u.name) === cleanTarget) return true;
    return false;
  });

  if (userMatch?.name && !isIdLike(userMatch.name)) {
    return userMatch.name;
  }

  // 4. Fallback formatting
  if (vehicleMatch?.prefix) {
    return `Motorista (${vehicleMatch.prefix})`;
  }

  if (masterMatch?.name) return masterMatch.name;
  if (vehicleMatch?.name) return vehicleMatch.name;
  if (userMatch?.name) return userMatch.name;

  return target;
}
